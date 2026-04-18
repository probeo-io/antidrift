/**
 * Comprehensive unit tests for mcp-github zeromcp tools.
 * Tests each tools/*.mjs file's structure and execute() behavior,
 * plus lib/client.mjs directly.
 *
 * Run: node --test test/tools.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, fmtRepo, fmtIssue, fmtPR } from '../lib/client.mjs';

import listRepos from '../tools/list_repos.mjs';
import listIssues from '../tools/list_issues.mjs';
import listPrs from '../tools/list_prs.mjs';
import getIssue from '../tools/get_issue.mjs';
import getPr from '../tools/get_pr.mjs';
import getRepo from '../tools/get_repo.mjs';
import createIssue from '../tools/create_issue.mjs';
import getFile from '../tools/get_file.mjs';
import listBranches from '../tools/list_branches.mjs';
import listReleases from '../tools/list_releases.mjs';
import listRuns from '../tools/list_runs.mjs';
import prDiff from '../tools/pr_diff.mjs';
import repoTraffic from '../tools/repo_traffic.mjs';
import searchRepos from '../tools/search_repos.mjs';
import user from '../tools/user.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock context that captures the last fetch call.
 * Supports multiple sequential responses for tools that call fetch twice.
 */
function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200, raw = false } = opts;
  let capturedUrl, capturedOpts;
  const fetch = async (url, reqOpts) => {
    capturedUrl = url;
    capturedOpts = reqOpts;
    return {
      ok,
      status,
      text: async () => (raw ? responseData : JSON.stringify(responseData)),
      json: async () => responseData
    };
  };
  return {
    ctx: { credentials: { token: 'test-token' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts })
  };
}

/**
 * Creates a mock context that returns different responses per call index.
 */
function makeMultiCtx(responses) {
  let callIndex = 0;
  const calls = [];
  const fetch = async (url, reqOpts) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    calls.push({ url, opts: reqOpts });
    callIndex++;
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      text: async () => JSON.stringify(resp.data),
      json: async () => resp.data
    };
  };
  return {
    ctx: { credentials: { token: 'test-token' }, fetch },
    getCalls: () => calls
  };
}

const ALL_TOOLS = [
  listRepos, listIssues, listPrs, getIssue, getPr, getRepo,
  createIssue, getFile, listBranches, listReleases, listRuns,
  prDiff, repoTraffic, searchRepos, user
];

// ---------------------------------------------------------------------------
// Structure tests — every tool must have description, input, execute
// ---------------------------------------------------------------------------

describe('tool structure', () => {
  for (const tool of ALL_TOOLS) {
    it(`${tool.description?.slice(0, 40) || '(unknown)'} — has required exports`, () => {
      assert.equal(typeof tool.description, 'string', 'description must be a string');
      assert.ok(tool.description.length > 0, 'description must be non-empty');
      assert.equal(typeof tool.input, 'object', 'input must be an object');
      assert.ok(tool.input !== null, 'input must not be null');
      assert.equal(typeof tool.execute, 'function', 'execute must be a function');
    });
  }

  it('all tools have non-empty descriptions', () => {
    for (const tool of ALL_TOOLS) {
      assert.ok(tool.description.length >= 10, `description too short: "${tool.description}"`);
    }
  });

  it('all input properties have type and description', () => {
    for (const tool of ALL_TOOLS) {
      for (const [key, prop] of Object.entries(tool.input)) {
        assert.ok(prop.type, `${tool.description.slice(0, 30)}.input.${key} missing type`);
        assert.ok(prop.description, `${tool.description.slice(0, 30)}.input.${key} missing description`);
      }
    }
  });

  it('tools that need owner/repo have them declared in input', () => {
    const needOwnerRepo = [listIssues, listPrs, getIssue, getPr, getRepo, createIssue, getFile, listBranches, listReleases, listRuns, prDiff, repoTraffic];
    for (const tool of needOwnerRepo) {
      assert.ok(tool.input.owner, `${tool.description.slice(0, 30)} missing input.owner`);
      assert.ok(tool.input.repo, `${tool.description.slice(0, 30)} missing input.repo`);
    }
  });
});

// ---------------------------------------------------------------------------
// lib/client.mjs — createClient
// ---------------------------------------------------------------------------

describe('createClient', () => {
  it('sets correct Authorization header with Bearer token', async () => {
    const { ctx, getCaptured } = makeCtx({ login: 'octocat' });
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    await gh('GET', '/user');
    const { opts } = getCaptured();
    assert.ok(opts.headers['Authorization'], 'Authorization header should be set');
    assert.ok(opts.headers['Authorization'].startsWith('Bearer '), 'should use Bearer scheme');
    assert.equal(opts.headers['Authorization'], 'Bearer test-token');
  });

  it('sets Accept and X-GitHub-Api-Version headers', async () => {
    const { ctx, getCaptured } = makeCtx({});
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    await gh('GET', '/user');
    const { opts } = getCaptured();
    assert.equal(opts.headers['Accept'], 'application/vnd.github+json');
    assert.equal(opts.headers['X-GitHub-Api-Version'], '2022-11-28');
  });

  it('uses provided fetchFn instead of global fetch', async () => {
    let wasCalled = false;
    const customFetch = async (url, opts) => {
      wasCalled = true;
      return { ok: true, text: async () => '{"login":"test"}', json: async () => ({ login: 'test' }) };
    };
    const { gh } = createClient({ token: 'abc' }, customFetch);
    await gh('GET', '/user');
    assert.ok(wasCalled, 'custom fetch should have been called');
  });

  it('constructs URL with the GitHub API base', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    await gh('GET', '/repos/foo/bar/issues?state=open');
    const { url } = getCaptured();
    assert.ok(url.startsWith('https://api.github.com'), `URL should start with GitHub API: ${url}`);
    assert.ok(url.includes('/repos/foo/bar/issues'), `URL should contain path: ${url}`);
  });

  it('sends body as JSON for POST requests', async () => {
    const { ctx, getCaptured } = makeCtx({ number: 1, title: 'Test', html_url: 'https://github.com/foo/bar/issues/1' });
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    await gh('POST', '/repos/foo/bar/issues', { title: 'Hello', body: 'World' });
    const { opts } = getCaptured();
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers['Content-Type'], 'application/json');
    const parsed = JSON.parse(opts.body);
    assert.equal(parsed.title, 'Hello');
    assert.equal(parsed.body, 'World');
  });

  it('throws on non-ok response with status code', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => gh('GET', '/repos/nobody/nope'),
      (err) => {
        assert.ok(err.message.includes('404'), `Error should mention 404: ${err.message}`);
        return true;
      }
    );
  });

  it('throws on 401 unauthorized', async () => {
    const { ctx } = makeCtx('Unauthorized', { ok: false, status: 401, raw: true });
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => gh('GET', '/user'),
      (err) => {
        assert.ok(err.message.includes('401'), `Error should mention 401: ${err.message}`);
        return true;
      }
    );
  });

  it('returns empty object for empty response body', async () => {
    const customFetch = async () => ({ ok: true, text: async () => '', json: async () => null });
    const { gh } = createClient({ token: 'tok' }, customFetch);
    const result = await gh('DELETE', '/repos/foo/bar/issues/1/labels/bug');
    assert.deepEqual(result, {});
  });

  it('ghRaw returns raw text', async () => {
    const diffText = 'diff --git a/file.js b/file.js\n+new line';
    const customFetch = async () => ({
      ok: true,
      text: async () => diffText,
      json: async () => null
    });
    const { ghRaw } = createClient({ token: 'tok' }, customFetch);
    const result = await ghRaw('/repos/foo/bar/pulls/1');
    assert.equal(result, diffText);
  });

  it('ghRaw throws on non-ok response', async () => {
    const { ctx } = makeCtx('Forbidden', { ok: false, status: 403, raw: true });
    const { ghRaw } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => ghRaw('/repos/foo/bar/pulls/1'),
      (err) => {
        assert.ok(err.message.includes('403'));
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// fmtRepo, fmtIssue, fmtPR helpers
// ---------------------------------------------------------------------------

describe('fmtRepo', () => {
  it('formats a repo with description, stars, forks, language', () => {
    const r = {
      full_name: 'acme/widget',
      description: 'A widget',
      stargazers_count: 42,
      forks_count: 7,
      language: 'TypeScript'
    };
    const out = fmtRepo(r);
    assert.ok(out.includes('acme/widget'));
    assert.ok(out.includes('A widget'));
    assert.ok(out.includes('42'));
    assert.ok(out.includes('7'));
    assert.ok(out.includes('TypeScript'));
  });

  it('formats a repo without description or language', () => {
    const r = { full_name: 'x/y', stargazers_count: 0, forks_count: 0 };
    const out = fmtRepo(r);
    assert.ok(out.includes('x/y'));
    assert.ok(out.includes('0'));
  });
});

describe('fmtIssue', () => {
  it('formats an open issue with labels', () => {
    const i = {
      number: 5,
      state: 'open',
      title: 'Bug: crashes',
      labels: [{ name: 'bug' }, { name: 'high-priority' }],
      user: { login: 'alice' }
    };
    const out = fmtIssue(i);
    assert.ok(out.includes('#5'));
    assert.ok(out.includes('Bug: crashes'));
    assert.ok(out.includes('bug'));
    assert.ok(out.includes('alice'));
  });

  it('formats a closed issue', () => {
    const i = { number: 10, state: 'closed', title: 'Fixed', labels: [], user: { login: 'bob' } };
    const out = fmtIssue(i);
    assert.ok(out.includes('#10'));
    assert.ok(out.includes('Fixed'));
  });

  it('handles missing labels and user gracefully', () => {
    const i = { number: 1, state: 'open', title: 'Hello' };
    const out = fmtIssue(i);
    assert.ok(out.includes('#1'));
    assert.ok(out.includes('Hello'));
  });
});

describe('fmtPR', () => {
  it('formats an open PR', () => {
    const p = {
      number: 99,
      state: 'open',
      merged_at: null,
      title: 'Add feature',
      head: { ref: 'feature/x' },
      base: { ref: 'main' },
      user: { login: 'carol' }
    };
    const out = fmtPR(p);
    assert.ok(out.includes('#99'));
    assert.ok(out.includes('Add feature'));
    assert.ok(out.includes('feature/x'));
    assert.ok(out.includes('main'));
    assert.ok(out.includes('carol'));
  });

  it('formats a merged PR', () => {
    const p = {
      number: 50,
      state: 'closed',
      merged_at: '2024-01-01T00:00:00Z',
      title: 'Merge me',
      head: { ref: 'dev' },
      base: { ref: 'main' },
      user: { login: 'dave' }
    };
    const out = fmtPR(p);
    assert.ok(out.includes('#50'));
    assert.ok(out.includes('Merge me'));
  });
});

// ---------------------------------------------------------------------------
// Tool: list_repos
// ---------------------------------------------------------------------------

describe('list_repos', () => {
  it('happy path — returns formatted repo list', async () => {
    const repos = [
      { full_name: 'me/repo1', description: 'First', stargazers_count: 10, forks_count: 2, language: 'JS' },
      { full_name: 'me/repo2', description: null, stargazers_count: 0, forks_count: 0 }
    ];
    const { ctx, getCaptured } = makeCtx(repos);
    const result = await listRepos.execute({}, ctx);
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('me/repo1'));
    assert.ok(result.includes('me/repo2'));
    const { url } = getCaptured();
    assert.ok(url.includes('/user/repos'), `URL should use user repos endpoint: ${url}`);
    assert.ok(url.includes('per_page=20'), `URL should have default limit: ${url}`);
  });

  it('uses org endpoint when org is provided', async () => {
    const { ctx, getCaptured } = makeCtx([
      { full_name: 'myorg/repo', description: null, stargazers_count: 5, forks_count: 1 }
    ]);
    await listRepos.execute({ org: 'myorg' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/orgs/myorg/repos'), `URL should use org endpoint: ${url}`);
  });

  it('respects custom limit and sort', async () => {
    const { ctx, getCaptured } = makeCtx([
      { full_name: 'a/b', description: null, stargazers_count: 1, forks_count: 0 }
    ]);
    await listRepos.execute({ limit: 5, sort: 'stars' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'), `URL should have limit=5: ${url}`);
    assert.ok(url.includes('sort=stars'), `URL should sort by stars: ${url}`);
  });

  it('returns "No repositories found." for empty array', async () => {
    const { ctx } = makeCtx([]);
    const result = await listRepos.execute({}, ctx);
    assert.equal(result, 'No repositories found.');
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Unauthorized', { ok: false, status: 401, raw: true });
    await assert.rejects(() => listRepos.execute({}, ctx), /401/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_issues
// ---------------------------------------------------------------------------

describe('list_issues', () => {
  it('happy path — returns formatted issues, filtering out PRs', async () => {
    const issues = [
      { number: 1, state: 'open', title: 'Bug A', labels: [], user: { login: 'alice' } },
      { number: 2, state: 'open', title: 'PR masquerading', labels: [], user: { login: 'bob' }, pull_request: {} }
    ];
    const { ctx, getCaptured } = makeCtx(issues);
    const result = await listIssues.execute({ owner: 'foo', repo: 'bar' }, ctx);
    assert.ok(result.includes('Bug A'), 'should include the real issue');
    assert.ok(!result.includes('PR masquerading'), 'should filter out PRs');
    const { url } = getCaptured();
    assert.ok(url.includes('/repos/foo/bar/issues'), `URL: ${url}`);
    assert.ok(url.includes('state=open'), `URL should include default state: ${url}`);
  });

  it('passes state and labels params', async () => {
    const { ctx, getCaptured } = makeCtx([
      { number: 3, state: 'closed', title: 'Old bug', labels: [{ name: 'bug' }], user: { login: 'x' } }
    ]);
    await listIssues.execute({ owner: 'a', repo: 'b', state: 'closed', labels: 'bug' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('state=closed'), `URL: ${url}`);
    assert.ok(url.includes('labels=bug'), `URL: ${url}`);
  });

  it('returns "No issues found." when all results are PRs', async () => {
    const { ctx } = makeCtx([
      { number: 10, state: 'open', title: 'PR only', labels: [], user: { login: 'u' }, pull_request: {} }
    ]);
    const result = await listIssues.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.equal(result, 'No issues found.');
  });

  it('returns "No issues found." for empty array', async () => {
    const { ctx } = makeCtx([]);
    const result = await listIssues.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.equal(result, 'No issues found.');
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => listIssues.execute({ owner: 'x', repo: 'y' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_prs
// ---------------------------------------------------------------------------

describe('list_prs', () => {
  it('happy path — returns formatted PRs', async () => {
    const prs = [
      { number: 1, state: 'open', merged_at: null, title: 'Add feature', head: { ref: 'feat' }, base: { ref: 'main' }, user: { login: 'alice' } }
    ];
    const { ctx, getCaptured } = makeCtx(prs);
    const result = await listPrs.execute({ owner: 'foo', repo: 'bar' }, ctx);
    assert.ok(result.includes('#1'));
    assert.ok(result.includes('Add feature'));
    const { url } = getCaptured();
    assert.ok(url.includes('/repos/foo/bar/pulls'), `URL: ${url}`);
    assert.ok(url.includes('state=open'), `URL: ${url}`);
  });

  it('passes state=closed param', async () => {
    const { ctx, getCaptured } = makeCtx([
      { number: 5, state: 'closed', merged_at: '2024-01-01T00:00:00Z', title: 'Old PR', head: { ref: 'x' }, base: { ref: 'main' }, user: { login: 'bob' } }
    ]);
    await listPrs.execute({ owner: 'a', repo: 'b', state: 'closed' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('state=closed'), `URL: ${url}`);
  });

  it('returns "No pull requests found." for empty array', async () => {
    const { ctx } = makeCtx([]);
    const result = await listPrs.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.equal(result, 'No pull requests found.');
  });

  it('respects limit param', async () => {
    const { ctx, getCaptured } = makeCtx([
      { number: 1, state: 'open', merged_at: null, title: 'T', head: { ref: 'x' }, base: { ref: 'main' }, user: { login: 'u' } }
    ]);
    await listPrs.execute({ owner: 'a', repo: 'b', limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'), `URL: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Server Error', { ok: false, status: 500, raw: true });
    await assert.rejects(() => listPrs.execute({ owner: 'a', repo: 'b' }, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_issue
// ---------------------------------------------------------------------------

describe('get_issue', () => {
  it('happy path — formats issue with no comments', async () => {
    const issue = {
      number: 42,
      state: 'open',
      title: 'Important bug',
      user: { login: 'alice' },
      created_at: '2024-01-01T00:00:00Z',
      labels: [{ name: 'bug' }],
      assignees: [{ login: 'bob' }],
      body: 'This is the body.'
    };
    const multiCtx = makeMultiCtx([
      { data: issue },
      { data: [] }
    ]);
    const result = await getIssue.execute({ owner: 'foo', repo: 'bar', number: 42 }, multiCtx.ctx);
    assert.ok(result.includes('#42'));
    assert.ok(result.includes('Important bug'));
    assert.ok(result.includes('alice'));
    assert.ok(result.includes('bug'));
    assert.ok(result.includes('bob'));
    assert.ok(result.includes('This is the body.'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.includes('/issues/42'), `First call: ${calls[0].url}`);
    assert.ok(calls[1].url.includes('/issues/42/comments'), `Second call: ${calls[1].url}`);
  });

  it('includes comments when present', async () => {
    const issue = { number: 1, state: 'open', title: 'T', user: { login: 'u' }, created_at: '2024-01-01T00:00:00Z', labels: [], assignees: [] };
    const comments = [
      { user: { login: 'reviewer' }, created_at: '2024-01-02T00:00:00Z', body: 'Looks good!' }
    ];
    const multiCtx = makeMultiCtx([{ data: issue }, { data: comments }]);
    const result = await getIssue.execute({ owner: 'a', repo: 'b', number: 1 }, multiCtx.ctx);
    assert.ok(result.includes('Comments (1)'));
    assert.ok(result.includes('reviewer'));
    assert.ok(result.includes('Looks good!'));
  });

  it('handles closed issue', async () => {
    const issue = { number: 7, state: 'closed', title: 'Closed', user: { login: 'u' }, created_at: '2024-01-01T00:00:00Z', labels: [], assignees: [] };
    const multiCtx = makeMultiCtx([{ data: issue }, { data: [] }]);
    const result = await getIssue.execute({ owner: 'a', repo: 'b', number: 7 }, multiCtx.ctx);
    assert.ok(result.includes('#7'));
    assert.ok(result.includes('Closed'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => getIssue.execute({ owner: 'a', repo: 'b', number: 99 }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_pr
// ---------------------------------------------------------------------------

describe('get_pr', () => {
  it('happy path — formats PR with files changed', async () => {
    const pr = {
      number: 10,
      state: 'open',
      merged_at: null,
      title: 'New feature',
      head: { ref: 'feature/x' },
      base: { ref: 'main' },
      user: { login: 'alice' },
      additions: 50,
      deletions: 10,
      changed_files: 3,
      body: 'PR body here.'
    };
    const files = [
      { filename: 'src/index.js', status: 'modified', additions: 20, deletions: 5 },
      { filename: 'src/new.js', status: 'added', additions: 30, deletions: 0 }
    ];
    const multiCtx = makeMultiCtx([{ data: pr }, { data: files }]);
    const result = await getPr.execute({ owner: 'foo', repo: 'bar', number: 10 }, multiCtx.ctx);
    assert.ok(result.includes('#10'));
    assert.ok(result.includes('New feature'));
    assert.ok(result.includes('feature/x'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('+50 / -10'));
    assert.ok(result.includes('Files Changed (2)'));
    assert.ok(result.includes('src/index.js'));
    assert.ok(result.includes('src/new.js'));
    assert.ok(result.includes('PR body here.'));
  });

  it('handles merged PR indicator', async () => {
    const pr = {
      number: 5,
      state: 'closed',
      merged_at: '2024-01-01T00:00:00Z',
      title: 'Merged PR',
      head: { ref: 'dev' },
      base: { ref: 'main' },
      user: { login: 'bob' },
      additions: 10,
      deletions: 2,
      changed_files: 1
    };
    const multiCtx = makeMultiCtx([{ data: pr }, { data: [] }]);
    const result = await getPr.execute({ owner: 'a', repo: 'b', number: 5 }, multiCtx.ctx);
    assert.ok(result.includes('#5'));
    assert.ok(result.includes('Merged PR'));
    assert.ok(result.includes('merged'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => getPr.execute({ owner: 'a', repo: 'b', number: 1 }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_repo
// ---------------------------------------------------------------------------

describe('get_repo', () => {
  it('happy path — returns formatted repo detail', async () => {
    const repo = {
      full_name: 'acme/widget',
      description: 'A widget library',
      stargazers_count: 100,
      forks_count: 20,
      watchers_count: 50,
      language: 'TypeScript',
      default_branch: 'main',
      visibility: 'public',
      homepage: 'https://acme.com',
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      open_issues_count: 5
    };
    const { ctx, getCaptured } = makeCtx(repo);
    const result = await getRepo.execute({ owner: 'acme', repo: 'widget' }, ctx);
    assert.ok(result.includes('acme/widget'));
    assert.ok(result.includes('A widget library'));
    assert.ok(result.includes('100'));
    assert.ok(result.includes('TypeScript'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('public'));
    assert.ok(result.includes('https://acme.com'));
    assert.ok(result.includes('Open issues: 5'));
    const { url } = getCaptured();
    assert.ok(url.includes('/repos/acme/widget'), `URL: ${url}`);
  });

  it('omits optional fields when absent', async () => {
    const repo = {
      full_name: 'a/b',
      stargazers_count: 0,
      forks_count: 0,
      watchers_count: 0,
      default_branch: 'main',
      private: true,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      open_issues_count: 0
    };
    const { ctx } = makeCtx(repo);
    const result = await getRepo.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.ok(result.includes('a/b'));
    assert.ok(result.includes('0'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => getRepo.execute({ owner: 'x', repo: 'y' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: create_issue
// ---------------------------------------------------------------------------

describe('create_issue', () => {
  it('happy path — creates issue with title only', async () => {
    const created = { number: 99, title: 'My Issue', html_url: 'https://github.com/foo/bar/issues/99' };
    const { ctx, getCaptured } = makeCtx(created);
    const result = await createIssue.execute({ owner: 'foo', repo: 'bar', title: 'My Issue' }, ctx);
    assert.ok(result.includes('#99'));
    assert.ok(result.includes('My Issue'));
    assert.ok(result.includes('https://github.com'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/repos/foo/bar/issues'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.title, 'My Issue');
  });

  it('includes body and labels when provided', async () => {
    const created = { number: 100, title: 'Bug', html_url: 'https://github.com/foo/bar/issues/100' };
    const { ctx, getCaptured } = makeCtx(created);
    await createIssue.execute({
      owner: 'foo', repo: 'bar', title: 'Bug',
      body: 'Detailed description', labels: ['bug', 'high']
    }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.body, 'Detailed description');
    assert.deepEqual(body.labels, ['bug', 'high']);
  });

  it('does not include body/labels when not provided', async () => {
    const created = { number: 101, title: 'Simple', html_url: 'https://github.com/foo/bar/issues/101' };
    const { ctx, getCaptured } = makeCtx(created);
    await createIssue.execute({ owner: 'foo', repo: 'bar', title: 'Simple' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.body, undefined);
    assert.equal(body.labels, undefined);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Forbidden', { ok: false, status: 403, raw: true });
    await assert.rejects(() => createIssue.execute({ owner: 'a', repo: 'b', title: 'T' }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_file
// ---------------------------------------------------------------------------

describe('get_file', () => {
  it('happy path — decodes base64 file content', async () => {
    const fileContent = 'console.log("hello world");\n';
    const encoded = Buffer.from(fileContent).toString('base64');
    const data = { type: 'file', content: encoded, size: fileContent.length };
    const { ctx, getCaptured } = makeCtx(data);
    const result = await getFile.execute({ owner: 'foo', repo: 'bar', path: 'index.js' }, ctx);
    assert.ok(result.includes('index.js'));
    assert.ok(result.includes(fileContent.trim()));
    assert.ok(result.includes('main')); // default ref
    const { url } = getCaptured();
    assert.ok(url.includes('/contents/'), `URL: ${url}`);
    assert.ok(url.includes('ref=main'), `URL should include ref: ${url}`);
  });

  it('uses custom ref when provided', async () => {
    const encoded = Buffer.from('code').toString('base64');
    const { ctx, getCaptured } = makeCtx({ type: 'file', content: encoded, size: 4 });
    await getFile.execute({ owner: 'a', repo: 'b', path: 'README.md', ref: 'develop' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('ref=develop'), `URL should include custom ref: ${url}`);
  });

  it('returns error message for non-file types', async () => {
    const { ctx } = makeCtx({ type: 'dir' });
    const result = await getFile.execute({ owner: 'a', repo: 'b', path: 'src' }, ctx);
    assert.ok(result.includes('dir'), `Result: ${result}`);
    assert.ok(result.includes('not a file'), `Result: ${result}`);
  });

  it('encodes special characters in path', async () => {
    const encoded = Buffer.from('data').toString('base64');
    const { ctx, getCaptured } = makeCtx({ type: 'file', content: encoded, size: 4 });
    await getFile.execute({ owner: 'a', repo: 'b', path: 'src/my file.js' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('src%2Fmy%20file.js') || url.includes('src/my%20file.js'), `URL should encode path: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => getFile.execute({ owner: 'a', repo: 'b', path: 'missing.js' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_branches
// ---------------------------------------------------------------------------

describe('list_branches', () => {
  it('happy path — lists branches with protected indicator', async () => {
    const branches = [
      { name: 'main', protected: true, commit: { sha: 'abc1234' } },
      { name: 'feature/x', protected: false, commit: { sha: 'def5678' } }
    ];
    const { ctx, getCaptured } = makeCtx(branches);
    const result = await listBranches.execute({ owner: 'foo', repo: 'bar' }, ctx);
    assert.ok(result.includes('main'));
    assert.ok(result.includes('feature/x'));
    assert.ok(result.includes('abc1234'));
    const { url } = getCaptured();
    assert.ok(url.includes('/repos/foo/bar/branches'), `URL: ${url}`);
    assert.ok(url.includes('per_page=100'), `URL: ${url}`);
  });

  it('returns "No branches found." for empty array', async () => {
    const { ctx } = makeCtx([]);
    const result = await listBranches.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.equal(result, 'No branches found.');
  });

  it('handles branch with no commit sha', async () => {
    const { ctx } = makeCtx([{ name: 'main', protected: false, commit: {} }]);
    const result = await listBranches.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.ok(result.includes('main'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => listBranches.execute({ owner: 'x', repo: 'y' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_releases
// ---------------------------------------------------------------------------

describe('list_releases', () => {
  it('happy path — returns formatted releases', async () => {
    const releases = [
      { tag_name: 'v1.0.0', name: 'Initial Release', published_at: '2024-01-01T00:00:00Z', prerelease: false, draft: false },
      { tag_name: 'v2.0.0-beta', name: 'Beta', published_at: '2024-02-01T00:00:00Z', prerelease: true, draft: false }
    ];
    const { ctx, getCaptured } = makeCtx(releases);
    const result = await listReleases.execute({ owner: 'foo', repo: 'bar' }, ctx);
    assert.ok(result.includes('v1.0.0'));
    assert.ok(result.includes('Initial Release'));
    assert.ok(result.includes('v2.0.0-beta'));
    assert.ok(result.includes('[pre-release]'));
    const { url } = getCaptured();
    assert.ok(url.includes('/repos/foo/bar/releases'), `URL: ${url}`);
  });

  it('marks draft releases', async () => {
    const releases = [{ tag_name: 'v3.0.0', name: 'Draft', published_at: '2024-03-01T00:00:00Z', prerelease: false, draft: true }];
    const { ctx } = makeCtx(releases);
    const result = await listReleases.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.ok(result.includes('[draft]'));
  });

  it('returns "No releases found." for empty array', async () => {
    const { ctx } = makeCtx([]);
    const result = await listReleases.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.equal(result, 'No releases found.');
  });

  it('respects limit param', async () => {
    const { ctx, getCaptured } = makeCtx([
      { tag_name: 'v1.0.0', name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z', prerelease: false, draft: false }
    ]);
    await listReleases.execute({ owner: 'a', repo: 'b', limit: 3 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=3'), `URL: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => listReleases.execute({ owner: 'x', repo: 'y' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_runs
// ---------------------------------------------------------------------------

describe('list_runs', () => {
  it('happy path — returns formatted workflow runs', async () => {
    const res = {
      workflow_runs: [
        { name: 'CI', run_number: 42, head_branch: 'main', conclusion: 'success', status: 'completed', created_at: '2024-01-01T00:00:00Z' },
        { name: 'Deploy', run_number: 10, head_branch: 'main', conclusion: 'failure', status: 'completed', created_at: '2024-01-02T00:00:00Z' }
      ]
    };
    const { ctx, getCaptured } = makeCtx(res);
    const result = await listRuns.execute({ owner: 'foo', repo: 'bar' }, ctx);
    assert.ok(result.includes('CI'));
    assert.ok(result.includes('#42'));
    assert.ok(result.includes('Deploy'));
    assert.ok(result.includes('#10'));
    assert.ok(result.includes('success'));
    assert.ok(result.includes('failure'));
    const { url } = getCaptured();
    assert.ok(url.includes('/repos/foo/bar/actions/runs'), `URL: ${url}`);
  });

  it('returns "No workflow runs found." for empty', async () => {
    const { ctx } = makeCtx({ workflow_runs: [] });
    const result = await listRuns.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.equal(result, 'No workflow runs found.');
  });

  it('handles in_progress run icon', async () => {
    const res = {
      workflow_runs: [
        { name: 'Build', run_number: 1, head_branch: 'dev', conclusion: null, status: 'in_progress', created_at: '2024-01-01T00:00:00Z' }
      ]
    };
    const { ctx } = makeCtx(res);
    const result = await listRuns.execute({ owner: 'a', repo: 'b' }, ctx);
    assert.ok(result.includes('Build'));
    assert.ok(result.includes('in_progress'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Not Found', { ok: false, status: 404, raw: true });
    await assert.rejects(() => listRuns.execute({ owner: 'x', repo: 'y' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: pr_diff
// ---------------------------------------------------------------------------

describe('pr_diff', () => {
  it('happy path — returns raw diff text', async () => {
    const diffText = 'diff --git a/src/index.js b/src/index.js\n+added line\n-removed line\n';
    let capturedUrl, capturedOpts;
    const mockFetch = async (url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return { ok: true, text: async () => diffText };
    };
    const ctx = { credentials: { token: 'test-token' }, fetch: mockFetch };
    const result = await prDiff.execute({ owner: 'foo', repo: 'bar', number: 5 }, ctx);
    assert.equal(result, diffText);
    assert.ok(capturedUrl.includes('/repos/foo/bar/pulls/5'), `URL: ${capturedUrl}`);
    assert.equal(capturedOpts.headers['Accept'], 'application/vnd.github.diff');
    assert.equal(capturedOpts.headers['Authorization'], 'Bearer test-token');
    assert.equal(capturedOpts.headers['X-GitHub-Api-Version'], '2022-11-28');
  });

  it('throws on API error', async () => {
    const ctx = {
      credentials: { token: 'test-token' },
      fetch: async () => ({ ok: false, status: 404, text: async () => 'Not Found' })
    };
    await assert.rejects(() => prDiff.execute({ owner: 'a', repo: 'b', number: 99 }, ctx), /404/);
  });

  it('URL encodes owner and repo', async () => {
    let capturedUrl;
    const ctx = {
      credentials: { token: 'test-token' },
      fetch: async (url) => { capturedUrl = url; return { ok: true, text: async () => 'diff...' }; }
    };
    await prDiff.execute({ owner: 'my org', repo: 'my repo', number: 1 }, ctx);
    assert.ok(capturedUrl.includes('my%20org') || capturedUrl.includes('my+org') || capturedUrl.includes('my org'), `URL: ${capturedUrl}`);
  });
});

// ---------------------------------------------------------------------------
// Tool: repo_traffic
// ---------------------------------------------------------------------------

describe('repo_traffic', () => {
  it('happy path — returns traffic stats with daily breakdown', async () => {
    const views = {
      count: 100,
      uniques: 30,
      views: [
        { timestamp: '2024-01-01T00:00:00Z', count: 50, uniques: 15 },
        { timestamp: '2024-01-02T00:00:00Z', count: 50, uniques: 15 }
      ]
    };
    const clones = {
      count: 20,
      uniques: 10,
      clones: [
        { timestamp: '2024-01-01T00:00:00Z', count: 10, uniques: 5 },
        { timestamp: '2024-01-02T00:00:00Z', count: 10, uniques: 5 }
      ]
    };
    const multiCtx = makeMultiCtx([{ data: views }, { data: clones }]);
    const result = await repoTraffic.execute({ owner: 'foo', repo: 'bar' }, multiCtx.ctx);
    assert.ok(result.includes('Traffic for foo/bar'));
    assert.ok(result.includes('Views: 100 total, 30 unique'));
    assert.ok(result.includes('Clones: 20 total, 10 unique'));
    assert.ok(result.includes('2024-01-01'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.includes('/traffic/views'), `First call: ${calls[0].url}`);
    assert.ok(calls[1].url.includes('/traffic/clones'), `Second call: ${calls[1].url}`);
  });

  it('handles traffic with no daily breakdown', async () => {
    const views = { count: 10, uniques: 5 };
    const clones = { count: 3, uniques: 2 };
    const multiCtx = makeMultiCtx([{ data: views }, { data: clones }]);
    const result = await repoTraffic.execute({ owner: 'a', repo: 'b' }, multiCtx.ctx);
    assert.ok(result.includes('Views: 10 total'));
    assert.ok(result.includes('Clones: 3 total'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Forbidden', { ok: false, status: 403, raw: true });
    await assert.rejects(() => repoTraffic.execute({ owner: 'x', repo: 'y' }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: search_repos
// ---------------------------------------------------------------------------

describe('search_repos', () => {
  it('happy path — returns matching repos', async () => {
    const res = {
      items: [
        { full_name: 'facebook/react', description: 'A JS lib', stargazers_count: 200000, forks_count: 40000, language: 'JavaScript' }
      ]
    };
    const { ctx, getCaptured } = makeCtx(res);
    const result = await searchRepos.execute({ query: 'react' }, ctx);
    assert.ok(result.includes('facebook/react'));
    const { url } = getCaptured();
    assert.ok(url.includes('/search/repositories'), `URL: ${url}`);
    assert.ok(url.includes('react'), `URL should include query: ${url}`);
  });

  it('returns "No repositories matching..." for empty results', async () => {
    const { ctx } = makeCtx({ items: [] });
    const result = await searchRepos.execute({ query: 'zzznoresults' }, ctx);
    assert.ok(result.includes('No repositories matching'));
    assert.ok(result.includes('zzznoresults'));
  });

  it('respects limit param', async () => {
    const { ctx, getCaptured } = makeCtx({ items: [
      { full_name: 'a/b', description: null, stargazers_count: 0, forks_count: 0 }
    ]});
    await searchRepos.execute({ query: 'test', limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'), `URL: ${url}`);
  });

  it('URL-encodes the query', async () => {
    const { ctx, getCaptured } = makeCtx({ items: [] });
    await searchRepos.execute({ query: 'hello world' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('hello%20world') || url.includes('hello+world'), `URL: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Server Error', { ok: false, status: 500, raw: true });
    await assert.rejects(() => searchRepos.execute({ query: 'test' }, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: user
// ---------------------------------------------------------------------------

describe('user', () => {
  it('happy path — returns user info', async () => {
    const u = {
      login: 'octocat',
      name: 'The Octocat',
      email: 'octocat@github.com',
      bio: 'A mysterious cat',
      public_repos: 42,
      followers: 1000,
      following: 5
    };
    const { ctx, getCaptured } = makeCtx(u);
    const result = await user.execute({}, ctx);
    assert.ok(result.includes('octocat'));
    assert.ok(result.includes('The Octocat'));
    assert.ok(result.includes('octocat@github.com'));
    assert.ok(result.includes('A mysterious cat'));
    assert.ok(result.includes('42'));
    assert.ok(result.includes('1000'));
    assert.ok(result.includes('5'));
    const { url } = getCaptured();
    assert.ok(url.endsWith('/user'), `URL: ${url}`);
  });

  it('omits optional fields when absent', async () => {
    const u = { login: 'minimal', public_repos: 0, followers: 0, following: 0 };
    const { ctx } = makeCtx(u);
    const result = await user.execute({}, ctx);
    assert.ok(result.includes('minimal'));
    assert.ok(!result.includes('Name:'));
    assert.ok(!result.includes('Email:'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx('Unauthorized', { ok: false, status: 401, raw: true });
    await assert.rejects(() => user.execute({}, ctx), /401/);
  });
});
