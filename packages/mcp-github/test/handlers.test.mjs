import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'github.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

let tools;
let toolMap;

function fakeFetch(data, { ok = true, status = 200, raw = false } = {}) {
  return async () => ({
    ok,
    status,
    text: async () => raw ? data : JSON.stringify(data),
    json: async () => data
  });
}

function handler(name) {
  return toolMap[name].handler;
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

// ---------------------------------------------------------------------------
// github_user
// ---------------------------------------------------------------------------
describe('github_user handler', () => {
  it('returns formatted user info', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      login: 'testuser', name: 'Test', email: 'test@test.com',
      bio: 'dev', public_repos: 5, followers: 10, following: 3
    }));

    const result = await handler('github_user')({});

    assert.ok(result.includes('testuser'));
    assert.ok(result.includes('Test'));
    assert.ok(result.includes('test@test.com'));
    assert.ok(result.includes('dev'));
    assert.ok(result.includes('5'));
    assert.ok(result.includes('10'));
    assert.ok(result.includes('3'));
  });

  it('handles user with no optional fields', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      login: 'minimaluser', public_repos: 0, followers: 0, following: 0
    }));

    const result = await handler('github_user')({});
    assert.ok(result.includes('minimaluser'));
    assert.ok(result.includes('0'));
    // Should not contain Name/Email/Bio lines for missing fields
    assert.ok(!result.includes('Name:'));
    assert.ok(!result.includes('Email:'));
    assert.ok(!result.includes('Bio:'));
  });
});

// ---------------------------------------------------------------------------
// github_list_repos
// ---------------------------------------------------------------------------
describe('github_list_repos handler', () => {
  it('returns formatted repo list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { full_name: 'user/repo1', description: 'desc one', stargazers_count: 5, forks_count: 2, language: 'JavaScript' },
      { full_name: 'user/repo2', description: 'desc two', stargazers_count: 12, forks_count: 0, language: 'TypeScript' }
    ]));

    const result = await handler('github_list_repos')({});

    assert.ok(result.includes('user/repo1'));
    assert.ok(result.includes('desc one'));
    assert.ok(result.includes('5'));
    assert.ok(result.includes('JavaScript'));
    assert.ok(result.includes('user/repo2'));
  });

  it('returns message when no repos found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));

    const result = await handler('github_list_repos')({});
    assert.equal(result, 'No repositories found.');
  });

  it('uses org path when org is provided', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      assert.ok(url.includes('/orgs/myorg/repos'));
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify([{ full_name: 'myorg/r', description: '', stargazers_count: 1, forks_count: 0, language: null }]),
        json: async () => [{ full_name: 'myorg/r', description: '', stargazers_count: 1, forks_count: 0, language: null }]
      };
    });

    const result = await handler('github_list_repos')({ org: 'myorg' });
    assert.ok(result.includes('myorg/r'));
  });
});

// ---------------------------------------------------------------------------
// github_get_repo
// ---------------------------------------------------------------------------
describe('github_get_repo handler', () => {
  it('returns full repo details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      full_name: 'owner/repo', description: 'A great repo',
      stargazers_count: 100, forks_count: 25, watchers_count: 80,
      language: 'Rust', default_branch: 'main', visibility: 'public',
      homepage: 'https://example.com',
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z',
      open_issues_count: 7
    }));

    const result = await handler('github_get_repo')({ owner: 'owner', repo: 'repo' });

    assert.ok(result.includes('owner/repo'));
    assert.ok(result.includes('A great repo'));
    assert.ok(result.includes('100'));
    assert.ok(result.includes('25'));
    assert.ok(result.includes('Rust'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('public'));
    assert.ok(result.includes('https://example.com'));
    assert.ok(result.includes('7'));
  });
});

// ---------------------------------------------------------------------------
// github_list_issues
// ---------------------------------------------------------------------------
describe('github_list_issues handler', () => {
  it('returns formatted issues with emoji and labels', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { number: 1, state: 'open', title: 'Bug found', labels: [{ name: 'bug' }], user: { login: 'dev' } },
      { number: 2, state: 'closed', title: 'Feature done', labels: [{ name: 'enhancement' }], user: { login: 'pm' } }
    ]));

    const result = await handler('github_list_issues')({ owner: 'o', repo: 'r' });

    assert.ok(result.includes('#1'));
    assert.ok(result.includes('Bug found'));
    assert.ok(result.includes('bug'));
    assert.ok(result.includes('dev'));
    // open gets green circle, closed gets red
    assert.ok(result.includes('\u{1F7E2}')); // green circle
    assert.ok(result.includes('\u{1F534}')); // red circle
  });

  it('filters out pull requests from issue list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { number: 1, state: 'open', title: 'Real issue', labels: [], user: { login: 'a' } },
      { number: 2, state: 'open', title: 'Actually a PR', labels: [], user: { login: 'b' }, pull_request: { url: 'x' } }
    ]));

    const result = await handler('github_list_issues')({ owner: 'o', repo: 'r' });

    assert.ok(result.includes('Real issue'));
    assert.ok(!result.includes('Actually a PR'));
  });

  it('returns message when no issues after filtering', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { number: 1, state: 'open', title: 'PR only', labels: [], user: { login: 'x' }, pull_request: { url: 'y' } }
    ]));

    const result = await handler('github_list_issues')({ owner: 'o', repo: 'r' });
    assert.equal(result, 'No issues found.');
  });
});

// ---------------------------------------------------------------------------
// github_create_issue
// ---------------------------------------------------------------------------
describe('github_create_issue handler', () => {
  it('creates issue and returns confirmation with URL', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ number: 42, title: 'New bug', html_url: 'https://github.com/owner/repo/issues/42' }),
        json: async () => ({ number: 42, title: 'New bug', html_url: 'https://github.com/owner/repo/issues/42' })
      };
    });

    const result = await handler('github_create_issue')({
      owner: 'owner', repo: 'repo', title: 'New bug', body: 'It broke', labels: ['bug', 'urgent']
    });

    assert.ok(result.includes('#42'));
    assert.ok(result.includes('https://github.com/owner/repo/issues/42'));
    assert.equal(capturedBody.title, 'New bug');
    assert.equal(capturedBody.body, 'It broke');
    assert.deepEqual(capturedBody.labels, ['bug', 'urgent']);
  });

  it('sends only title when body and labels are omitted', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ number: 1, title: 'Simple', html_url: 'https://github.com/o/r/issues/1' }),
        json: async () => ({ number: 1, title: 'Simple', html_url: 'https://github.com/o/r/issues/1' })
      };
    });

    await handler('github_create_issue')({ owner: 'o', repo: 'r', title: 'Simple' });

    assert.equal(capturedBody.title, 'Simple');
    assert.equal(capturedBody.body, undefined);
    assert.equal(capturedBody.labels, undefined);
  });
});

// ---------------------------------------------------------------------------
// github_get_pr
// ---------------------------------------------------------------------------
describe('github_get_pr handler', () => {
  it('returns formatted PR with files changed', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callCount++;
      // First call: PR details, second call: files
      if (url.includes('/files')) {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify([
            { filename: 'src/index.js', status: 'modified', additions: 10, deletions: 3 },
            { filename: 'src/new.js', status: 'added', additions: 50, deletions: 0 }
          ]),
          json: async () => [
            { filename: 'src/index.js', status: 'modified', additions: 10, deletions: 3 },
            { filename: 'src/new.js', status: 'added', additions: 50, deletions: 0 }
          ]
        };
      }
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({
          number: 7, state: 'open', title: 'Add feature',
          head: { ref: 'feature-branch' }, base: { ref: 'main' },
          user: { login: 'dev' }, additions: 60, deletions: 3,
          changed_files: 2, merged_at: null, body: 'This adds a feature'
        }),
        json: async () => ({
          number: 7, state: 'open', title: 'Add feature',
          head: { ref: 'feature-branch' }, base: { ref: 'main' },
          user: { login: 'dev' }, additions: 60, deletions: 3,
          changed_files: 2, merged_at: null, body: 'This adds a feature'
        })
      };
    });

    const result = await handler('github_get_pr')({ owner: 'o', repo: 'r', number: 7 });

    assert.ok(result.includes('#7'));
    assert.ok(result.includes('Add feature'));
    assert.ok(result.includes('feature-branch'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('dev'));
    assert.ok(result.includes('+60'));
    assert.ok(result.includes('-3'));
    assert.ok(result.includes('src/index.js'));
    assert.ok(result.includes('src/new.js'));
    assert.ok(result.includes('This adds a feature'));
  });

  it('shows merged indicator for merged PR', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('/files')) {
        return { ok: true, status: 200, text: async () => '[]', json: async () => [] };
      }
      const pr = {
        number: 10, state: 'closed', title: 'Merged PR',
        head: { ref: 'feat' }, base: { ref: 'main' },
        user: { login: 'dev' }, additions: 1, deletions: 1,
        changed_files: 1, merged_at: '2024-01-01T00:00:00Z', body: null
      };
      return { ok: true, status: 200, text: async () => JSON.stringify(pr), json: async () => pr };
    });

    const result = await handler('github_get_pr')({ owner: 'o', repo: 'r', number: 10 });
    assert.ok(result.includes('merged'));
    assert.ok(result.includes('\u{1F7E3}')); // purple circle
  });
});

// ---------------------------------------------------------------------------
// github_pr_diff
// ---------------------------------------------------------------------------
describe('github_pr_diff handler', () => {
  it('returns raw diff text', async () => {
    const diffText = 'diff --git a/file.js b/file.js\n--- a/file.js\n+++ b/file.js\n@@ -1,3 +1,4 @@\n+new line';
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => diffText,
      json: async () => diffText
    }));

    const result = await handler('github_pr_diff')({ owner: 'o', repo: 'r', number: 1 });
    assert.equal(result, diffText);
  });

  it('sends diff Accept header', async () => {
    let capturedHeaders;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, text: async () => 'diff content', json: async () => 'diff content' };
    });

    await handler('github_pr_diff')({ owner: 'o', repo: 'r', number: 1 });
    assert.equal(capturedHeaders['Accept'], 'application/vnd.github.diff');
  });
});

// ---------------------------------------------------------------------------
// github_list_branches
// ---------------------------------------------------------------------------
describe('github_list_branches handler', () => {
  it('returns formatted branch list with protected indicator', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { name: 'main', protected: true, commit: { sha: 'abc1234567' } },
      { name: 'dev', protected: false, commit: { sha: 'def7890123' } }
    ]));

    const result = await handler('github_list_branches')({ owner: 'o', repo: 'r' });

    assert.ok(result.includes('main'));
    assert.ok(result.includes('dev'));
    assert.ok(result.includes('abc1234'));
    assert.ok(result.includes('def7890'));
    // Protected branch should have shield emoji
    assert.ok(result.includes('\u{1F6E1}'));
  });

  it('returns message when no branches found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('github_list_branches')({ owner: 'o', repo: 'r' });
    assert.equal(result, 'No branches found.');
  });
});

// ---------------------------------------------------------------------------
// github_repo_traffic
// ---------------------------------------------------------------------------
describe('github_repo_traffic handler', () => {
  it('returns views and clones data', async () => {
    let callIndex = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      const isViews = url.includes('/views');
      const isClones = url.includes('/clones');
      let data;
      if (isViews) {
        data = { count: 200, uniques: 50, views: [{ timestamp: '2024-01-01T00:00:00Z', count: 100, uniques: 25 }] };
      } else if (isClones) {
        data = { count: 80, uniques: 30, clones: [{ timestamp: '2024-01-01T00:00:00Z', count: 40, uniques: 15 }] };
      } else {
        data = {};
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data };
    });

    const result = await handler('github_repo_traffic')({ owner: 'owner', repo: 'repo' });

    assert.ok(result.includes('owner/repo'));
    assert.ok(result.includes('200'));
    assert.ok(result.includes('50'));
    assert.ok(result.includes('80'));
    assert.ok(result.includes('30'));
    assert.ok(result.includes('2024-01-01'));
  });
});

// ---------------------------------------------------------------------------
// github_search_repos
// ---------------------------------------------------------------------------
describe('github_search_repos handler', () => {
  it('returns formatted search results', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      items: [
        { full_name: 'org/match', description: 'Matched repo', stargazers_count: 99, forks_count: 10, language: 'Go' }
      ]
    }));

    const result = await handler('github_search_repos')({ query: 'test' });
    assert.ok(result.includes('org/match'));
    assert.ok(result.includes('Matched repo'));
    assert.ok(result.includes('99'));
    assert.ok(result.includes('Go'));
  });

  it('returns message when no search results', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ items: [] }));
    const result = await handler('github_search_repos')({ query: 'nonexistent' });
    assert.ok(result.includes('No repositories matching'));
    assert.ok(result.includes('nonexistent'));
  });
});

// ---------------------------------------------------------------------------
// github_list_runs
// ---------------------------------------------------------------------------
describe('github_list_runs handler', () => {
  it('returns formatted workflow runs', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      workflow_runs: [
        { name: 'CI', run_number: 42, head_branch: 'main', conclusion: 'success', status: 'completed', created_at: '2024-01-01T00:00:00Z' },
        { name: 'Deploy', run_number: 5, head_branch: 'main', conclusion: 'failure', status: 'completed', created_at: '2024-01-02T00:00:00Z' }
      ]
    }));

    const result = await handler('github_list_runs')({ owner: 'o', repo: 'r' });
    assert.ok(result.includes('CI'));
    assert.ok(result.includes('#42'));
    assert.ok(result.includes('success'));
    assert.ok(result.includes('Deploy'));
    assert.ok(result.includes('failure'));
  });

  it('returns message when no runs found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ workflow_runs: [] }));
    const result = await handler('github_list_runs')({ owner: 'o', repo: 'r' });
    assert.equal(result, 'No workflow runs found.');
  });
});

// ---------------------------------------------------------------------------
// github_get_file
// ---------------------------------------------------------------------------
describe('github_get_file handler', () => {
  it('returns decoded file content', async () => {
    const content = Buffer.from('console.log("hello");').toString('base64');
    mock.method(globalThis, 'fetch', fakeFetch({
      type: 'file', content, size: 21
    }));

    const result = await handler('github_get_file')({ owner: 'o', repo: 'r', path: 'src/index.js' });
    assert.ok(result.includes('src/index.js'));
    assert.ok(result.includes('21 bytes'));
    assert.ok(result.includes('console.log("hello")'));
  });

  it('returns message when path is a directory', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ type: 'dir' }));
    const result = await handler('github_get_file')({ owner: 'o', repo: 'r', path: 'src' });
    assert.ok(result.includes('dir'));
    assert.ok(result.includes('not a file'));
  });
});

// ---------------------------------------------------------------------------
// github_list_releases
// ---------------------------------------------------------------------------
describe('github_list_releases handler', () => {
  it('returns formatted releases', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { tag_name: 'v1.0.0', name: 'First release', published_at: '2024-01-01T00:00:00Z', created_at: '2024-01-01', prerelease: false, draft: false },
      { tag_name: 'v2.0.0-beta', name: 'Beta', published_at: null, created_at: '2024-06-01', prerelease: true, draft: false }
    ]));

    const result = await handler('github_list_releases')({ owner: 'o', repo: 'r' });
    assert.ok(result.includes('v1.0.0'));
    assert.ok(result.includes('First release'));
    assert.ok(result.includes('v2.0.0-beta'));
    assert.ok(result.includes('pre-release'));
  });

  it('returns message when no releases found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('github_list_releases')({ owner: 'o', repo: 'r' });
    assert.equal(result, 'No releases found.');
  });
});

// ---------------------------------------------------------------------------
// github_get_issue (with comments)
// ---------------------------------------------------------------------------
describe('github_get_issue handler', () => {
  it('returns issue with comments', async () => {
    let callNum = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callNum++;
      let data;
      if (url.includes('/comments')) {
        data = [{ user: { login: 'commenter' }, created_at: '2024-01-02T00:00:00Z', body: 'Good catch!' }];
      } else {
        data = {
          number: 5, state: 'open', title: 'Crash on startup',
          user: { login: 'reporter' }, created_at: '2024-01-01T00:00:00Z',
          labels: [{ name: 'bug' }, { name: 'critical' }],
          assignees: [{ login: 'fixer' }],
          body: 'App crashes immediately'
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data };
    });

    const result = await handler('github_get_issue')({ owner: 'o', repo: 'r', number: 5 });
    assert.ok(result.includes('#5'));
    assert.ok(result.includes('Crash on startup'));
    assert.ok(result.includes('reporter'));
    assert.ok(result.includes('bug'));
    assert.ok(result.includes('critical'));
    assert.ok(result.includes('fixer'));
    assert.ok(result.includes('App crashes immediately'));
    assert.ok(result.includes('commenter'));
    assert.ok(result.includes('Good catch!'));
    assert.ok(result.includes('Comments (1)'));
  });
});

// ---------------------------------------------------------------------------
// github_list_prs
// ---------------------------------------------------------------------------
describe('github_list_prs handler', () => {
  it('returns formatted PR list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { number: 3, state: 'open', title: 'WIP feature', head: { ref: 'feat' }, base: { ref: 'main' }, user: { login: 'dev' }, merged_at: null },
      { number: 2, state: 'closed', title: 'Old PR', head: { ref: 'old' }, base: { ref: 'main' }, user: { login: 'pm' }, merged_at: '2024-01-01' }
    ]));

    const result = await handler('github_list_prs')({ owner: 'o', repo: 'r' });
    assert.ok(result.includes('#3'));
    assert.ok(result.includes('WIP feature'));
    assert.ok(result.includes('#2'));
    assert.ok(result.includes('Old PR'));
    assert.ok(result.includes('feat'));
  });

  it('returns message when no PRs found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('github_list_prs')({ owner: 'o', repo: 'r' });
    assert.equal(result, 'No pull requests found.');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('error handling', () => {
  it('throws on 404 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ message: 'Not Found' })
    }));

    await assert.rejects(
      () => handler('github_get_repo')({ owner: 'ghost', repo: 'gone' }),
      (err) => {
        assert.ok(err.message.includes('GitHub API 404'));
        return true;
      }
    );
  });

  it('throws on 403 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 403,
      text: async () => 'Forbidden',
      json: async () => ({ message: 'Forbidden' })
    }));

    await assert.rejects(
      () => handler('github_user')({}),
      (err) => {
        assert.ok(err.message.includes('GitHub API 403'));
        return true;
      }
    );
  });

  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Bad credentials',
      json: async () => ({ message: 'Bad credentials' })
    }));

    await assert.rejects(
      () => handler('github_list_repos')({}),
      (err) => {
        assert.ok(err.message.includes('GitHub API 401'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ message: 'Internal Server Error' })
    }));

    await assert.rejects(
      () => handler('github_list_branches')({ owner: 'o', repo: 'r' }),
      (err) => {
        assert.ok(err.message.includes('GitHub API 500'));
        return true;
      }
    );
  });

  it('error on pr_diff includes status code', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found'
    }));

    await assert.rejects(
      () => handler('github_pr_diff')({ owner: 'o', repo: 'r', number: 999 }),
      (err) => {
        assert.ok(err.message.includes('GitHub API 404'));
        return true;
      }
    );
  });
});
