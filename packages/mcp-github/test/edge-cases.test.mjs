import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'github.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

let tools;
let toolMap;

function handler(name) {
  return toolMap[name].handler;
}

function fakeFetch(data, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data
  });
}

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ token: 'test-token' }));

  const mod = await import('../connectors/github.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

afterEach(() => {
  mock.restoreAll();
});

// --- Edge-case tests ---

describe('github edge cases', () => {

  // ─── Error responses ─────────────────────────────────────────────────────

  describe('error responses', () => {
    it('throws on 401 unauthorized', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false, status: 401, text: async () => 'Bad credentials'
      }));
      await assert.rejects(
        () => handler('github_user')({}),
        (err) => { assert.ok(err.message.includes('401')); return true; }
      );
    });

    it('throws on 404 not found', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false, status: 404, text: async () => 'Not Found'
      }));
      await assert.rejects(
        () => handler('github_get_repo')({ owner: 'ghost', repo: 'nope' }),
        (err) => { assert.ok(err.message.includes('404')); return true; }
      );
    });

    it('throws on 429 rate limited', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false, status: 429, text: async () => 'API rate limit exceeded'
      }));
      await assert.rejects(
        () => handler('github_list_repos')({}),
        (err) => { assert.ok(err.message.includes('429')); return true; }
      );
    });

    it('throws on 500 server error', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false, status: 500, text: async () => 'Internal Server Error'
      }));
      await assert.rejects(
        () => handler('github_list_branches')({ owner: 'o', repo: 'r' }),
        (err) => { assert.ok(err.message.includes('500')); return true; }
      );
    });

    it('pr_diff throws on error with status code', async () => {
      mock.method(globalThis, 'fetch', async () => ({
        ok: false, status: 422, text: async () => 'Unprocessable Entity'
      }));
      await assert.rejects(
        () => handler('github_pr_diff')({ owner: 'o', repo: 'r', number: 1 }),
        (err) => { assert.ok(err.message.includes('422')); return true; }
      );
    });
  });

  // ─── Empty result sets ────────────────────────────────────────────────────

  describe('empty result sets', () => {
    it('github_list_repos returns message for empty array', async () => {
      mock.method(globalThis, 'fetch', fakeFetch([]));
      const result = await handler('github_list_repos')({});
      assert.equal(result, 'No repositories found.');
    });

    it('github_search_repos returns message for empty items', async () => {
      mock.method(globalThis, 'fetch', fakeFetch({ items: [] }));
      const result = await handler('github_search_repos')({ query: 'zzz' });
      assert.ok(result.includes('No repositories matching'));
    });

    it('github_list_issues returns message when all are PRs', async () => {
      mock.method(globalThis, 'fetch', fakeFetch([
        { number: 1, state: 'open', title: 'PR', labels: [], user: { login: 'x' }, pull_request: { url: 'y' } }
      ]));
      const result = await handler('github_list_issues')({ owner: 'o', repo: 'r' });
      assert.equal(result, 'No issues found.');
    });

    it('github_list_prs returns message for empty array', async () => {
      mock.method(globalThis, 'fetch', fakeFetch([]));
      const result = await handler('github_list_prs')({ owner: 'o', repo: 'r' });
      assert.equal(result, 'No pull requests found.');
    });

    it('github_list_branches returns message for empty array', async () => {
      mock.method(globalThis, 'fetch', fakeFetch([]));
      const result = await handler('github_list_branches')({ owner: 'o', repo: 'r' });
      assert.equal(result, 'No branches found.');
    });

    it('github_list_releases returns message for empty array', async () => {
      mock.method(globalThis, 'fetch', fakeFetch([]));
      const result = await handler('github_list_releases')({ owner: 'o', repo: 'r' });
      assert.equal(result, 'No releases found.');
    });

    it('github_list_runs returns message for empty workflow_runs', async () => {
      mock.method(globalThis, 'fetch', fakeFetch({ workflow_runs: [] }));
      const result = await handler('github_list_runs')({ owner: 'o', repo: 'r' });
      assert.equal(result, 'No workflow runs found.');
    });
  });

  // ─── Pagination / limit params ────────────────────────────────────────────

  describe('pagination and limit', () => {
    it('github_list_repos sends per_page from limit', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=5'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_repos')({ limit: 5 });
    });

    it('github_list_repos defaults limit to 20', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=20'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_repos')({});
    });

    it('github_list_issues sends per_page and state', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=10'));
        assert.ok(url.includes('state=closed'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_issues')({ owner: 'o', repo: 'r', state: 'closed', limit: 10 });
    });

    it('github_list_issues defaults to state=open and limit=20', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('state=open'));
        assert.ok(url.includes('per_page=20'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_issues')({ owner: 'o', repo: 'r' });
    });

    it('github_list_prs sends per_page from limit', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=3'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_prs')({ owner: 'o', repo: 'r', limit: 3 });
    });

    it('github_search_repos sends per_page from limit', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=7'));
        return { ok: true, status: 200, text: async () => JSON.stringify({ items: [] }) };
      });
      await handler('github_search_repos')({ query: 'test', limit: 7 });
    });

    it('github_list_runs sends per_page from limit', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=5'));
        return { ok: true, status: 200, text: async () => JSON.stringify({ workflow_runs: [] }) };
      });
      await handler('github_list_runs')({ owner: 'o', repo: 'r', limit: 5 });
    });

    it('github_list_releases sends per_page from limit', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('per_page=2'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_releases')({ owner: 'o', repo: 'r', limit: 2 });
    });
  });

  // ─── Optional parameters omitted ─────────────────────────────────────────

  describe('optional parameters omitted', () => {
    it('github_create_issue sends only title when body and labels omitted', async () => {
      let capturedBody;
      mock.method(globalThis, 'fetch', async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true, status: 201,
          text: async () => JSON.stringify({ number: 1, title: 'T', html_url: 'u' })
        };
      });
      await handler('github_create_issue')({ owner: 'o', repo: 'r', title: 'T' });
      assert.equal(capturedBody.title, 'T');
      assert.equal(capturedBody.body, undefined);
      assert.equal(capturedBody.labels, undefined);
    });

    it('github_list_issues omits labels param when not provided', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(!url.includes('labels='));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_issues')({ owner: 'o', repo: 'r' });
    });

    it('github_list_repos uses user path when org is omitted', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('/user/repos'));
        assert.ok(!url.includes('/orgs/'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_repos')({});
    });

    it('github_get_file defaults ref to main', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('ref=main'));
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ type: 'file', content: Buffer.from('hi').toString('base64'), size: 2 })
        };
      });
      await handler('github_get_file')({ owner: 'o', repo: 'r', path: 'f.txt' });
    });

    it('github_list_repos defaults sort to updated', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('sort=updated'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_repos')({});
    });
  });

  // ─── Special characters ───────────────────────────────────────────────────

  describe('special characters in input', () => {
    it('github_search_repos encodes query with special chars', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('q=react%20%26%20vue'));
        return { ok: true, status: 200, text: async () => JSON.stringify({ items: [] }) };
      });
      await handler('github_search_repos')({ query: 'react & vue' });
    });

    it('github_get_repo encodes owner and repo with special chars', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('/repos/my-org/my-repo'));
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({
            full_name: 'my-org/my-repo', stargazers_count: 0, forks_count: 0,
            watchers_count: 0, default_branch: 'main', open_issues_count: 0,
            created_at: '2024-01-01', updated_at: '2024-01-01'
          })
        };
      });
      await handler('github_get_repo')({ owner: 'my-org', repo: 'my-repo' });
    });

    it('github_list_issues encodes labels with special chars', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('labels=bug%20fix%2Curgent'));
        return { ok: true, status: 200, text: async () => '[]' };
      });
      await handler('github_list_issues')({ owner: 'o', repo: 'r', labels: 'bug fix,urgent' });
    });

    it('github_create_issue handles special chars in title and body', async () => {
      let capturedBody;
      mock.method(globalThis, 'fetch', async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true, status: 201,
          text: async () => JSON.stringify({ number: 1, title: 'Bug: "crash" & <hang>', html_url: 'u' })
        };
      });
      await handler('github_create_issue')({
        owner: 'o', repo: 'r',
        title: 'Bug: "crash" & <hang>',
        body: 'Steps:\n1. Open app\n2. Click <button>'
      });
      assert.equal(capturedBody.title, 'Bug: "crash" & <hang>');
      assert.equal(capturedBody.body, 'Steps:\n1. Open app\n2. Click <button>');
    });

    it('github_get_file encodes file path', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        assert.ok(url.includes('/contents/src%2Findex.ts'));
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ type: 'file', content: Buffer.from('x').toString('base64'), size: 1 })
        };
      });
      await handler('github_get_file')({ owner: 'o', repo: 'r', path: 'src/index.ts' });
    });
  });

  // ─── Complex input schemas ────────────────────────────────────────────────

  describe('complex input schemas', () => {
    it('github_create_issue sends labels array', async () => {
      let capturedBody;
      mock.method(globalThis, 'fetch', async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true, status: 201,
          text: async () => JSON.stringify({ number: 1, title: 'T', html_url: 'u' })
        };
      });
      await handler('github_create_issue')({
        owner: 'o', repo: 'r', title: 'Bug',
        labels: ['bug', 'critical', 'needs-triage']
      });
      assert.deepEqual(capturedBody.labels, ['bug', 'critical', 'needs-triage']);
    });

    it('github_repo_traffic makes parallel calls for views and clones', async () => {
      const urls = [];
      mock.method(globalThis, 'fetch', async (url) => {
        urls.push(url);
        const data = url.includes('/views')
          ? { count: 10, uniques: 5, views: [] }
          : { count: 3, uniques: 2, clones: [] };
        return { ok: true, status: 200, text: async () => JSON.stringify(data) };
      });
      await handler('github_repo_traffic')({ owner: 'o', repo: 'r' });
      assert.equal(urls.length, 2);
      assert.ok(urls.some(u => u.includes('/views')));
      assert.ok(urls.some(u => u.includes('/clones')));
    });

    it('github_get_issue makes two API calls (issue + comments)', async () => {
      const urls = [];
      mock.method(globalThis, 'fetch', async (url) => {
        urls.push(url);
        if (url.includes('/comments')) {
          return { ok: true, status: 200, text: async () => '[]' };
        }
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({
            number: 1, state: 'open', title: 'T', user: { login: 'u' },
            created_at: '2024-01-01', labels: [], assignees: [], body: null
          })
        };
      });
      await handler('github_get_issue')({ owner: 'o', repo: 'r', number: 1 });
      assert.equal(urls.length, 2);
      assert.ok(urls.some(u => u.includes('/comments')));
    });

    it('github_get_pr makes two API calls (pr + files)', async () => {
      const urls = [];
      mock.method(globalThis, 'fetch', async (url) => {
        urls.push(url);
        if (url.includes('/files')) {
          return { ok: true, status: 200, text: async () => '[]' };
        }
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({
            number: 1, state: 'open', title: 'PR', head: { ref: 'f' }, base: { ref: 'm' },
            user: { login: 'u' }, additions: 0, deletions: 0, changed_files: 0, body: null
          })
        };
      });
      await handler('github_get_pr')({ owner: 'o', repo: 'r', number: 1 });
      assert.equal(urls.length, 2);
      assert.ok(urls.some(u => u.includes('/files')));
    });
  });

  // ─── Formatting edge cases ────────────────────────────────────────────────

  describe('formatting edge cases', () => {
    it('github_user handles missing optional fields', async () => {
      mock.method(globalThis, 'fetch', fakeFetch({
        login: 'bare', public_repos: 0, followers: 0, following: 0
      }));
      const result = await handler('github_user')({});
      assert.ok(result.includes('bare'));
      assert.ok(!result.includes('Name:'));
      assert.ok(!result.includes('Email:'));
      assert.ok(!result.includes('Bio:'));
    });

    it('github_get_repo handles repo with no homepage', async () => {
      mock.method(globalThis, 'fetch', fakeFetch({
        full_name: 'o/r', stargazers_count: 0, forks_count: 0, watchers_count: 0,
        default_branch: 'main', open_issues_count: 0,
        created_at: '2024-01-01', updated_at: '2024-01-01',
        homepage: null, language: null, description: null
      }));
      const result = await handler('github_get_repo')({ owner: 'o', repo: 'r' });
      assert.ok(result.includes('o/r'));
      assert.ok(!result.includes('Homepage:'));
    });

    it('github_get_file returns message for directory type', async () => {
      mock.method(globalThis, 'fetch', fakeFetch({ type: 'dir' }));
      const result = await handler('github_get_file')({ owner: 'o', repo: 'r', path: 'src' });
      assert.ok(result.includes('dir'));
      assert.ok(result.includes('not a file'));
    });

    it('github_list_runs formats in-progress run', async () => {
      mock.method(globalThis, 'fetch', fakeFetch({
        workflow_runs: [{
          name: 'CI', run_number: 1, head_branch: 'main',
          conclusion: null, status: 'in_progress', created_at: '2024-01-01'
        }]
      }));
      const result = await handler('github_list_runs')({ owner: 'o', repo: 'r' });
      assert.ok(result.includes('in_progress'));
    });

    it('github_list_releases shows draft indicator', async () => {
      mock.method(globalThis, 'fetch', fakeFetch([
        { tag_name: 'v0.1.0', name: 'Draft', published_at: null, created_at: '2024-01-01', prerelease: false, draft: true }
      ]));
      const result = await handler('github_list_releases')({ owner: 'o', repo: 'r' });
      assert.ok(result.includes('[draft]'));
    });
  });
});
