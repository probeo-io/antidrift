/**
 * Comprehensive unit tests for mcp-netlify tools and lib/client.mjs
 * Uses Node.js built-in test runner (node:test) with mocked ctx pattern.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '../lib/client.mjs';

// ─── Tool imports ────────────────────────────────────────────────────────────
import getDeploy from '../tools/get_deploy.mjs';
import getSite from '../tools/get_site.mjs';
import listDeploys from '../tools/list_deploys.mjs';
import listEnvVars from '../tools/list_env_vars.mjs';
import listForms from '../tools/list_forms.mjs';
import listSites from '../tools/list_sites.mjs';
import listSubmissions from '../tools/list_submissions.mjs';
import rollback from '../tools/rollback.mjs';
import setEnvVar from '../tools/set_env_var.mjs';
import triggerBuild from '../tools/trigger_build.mjs';

// ─── Mock helper ─────────────────────────────────────────────────────────────
function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200 } = opts;
  let capturedUrl, capturedOpts;
  const allCalls = [];
  const fetch = async (url, reqOpts) => {
    capturedUrl = url;
    capturedOpts = reqOpts;
    allCalls.push({ url, opts: reqOpts });
    return {
      ok,
      status,
      text: async () => JSON.stringify(responseData),
      json: async () => responseData,
    };
  };
  return {
    ctx: { credentials: { token: 'test-nf-token' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts }),
    getAllCalls: () => allCalls,
  };
}

function makeErrCtx(status) {
  const fetch = async () => ({
    ok: false,
    status,
    text: async () => `Error ${status}`,
    json: async () => ({ message: `Error ${status}` }),
  });
  return { ctx: { credentials: { token: 'test-nf-token' }, fetch } };
}

// ─── lib/client.mjs ──────────────────────────────────────────────────────────
describe('createClient (netlify)', () => {
  it('routes through provided fetchFn with correct URL prefix', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ([]), text: async () => '[]' };
    };
    const { nf } = createClient({ token: 'nf-tok' }, mockFetch);
    await nf('GET', '/sites');
    assert.ok(captured.url.startsWith('https://api.netlify.com/api/v1'));
    assert.ok(captured.url.endsWith('/sites'));
  });

  it('sends Authorization: Bearer {token} header', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ([]), text: async () => '[]' };
    };
    const { nf } = createClient({ token: 'my-nf-token' }, mockFetch);
    await nf('GET', '/sites');
    assert.equal(captured.opts.headers['Authorization'], 'Bearer my-nf-token');
  });

  it('sends Content-Type application/json', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { nf } = createClient({ token: 'tok' }, mockFetch);
    await nf('POST', '/sites/s1/builds', {});
    assert.equal(captured.opts.headers['Content-Type'], 'application/json');
  });

  it('serializes body as JSON string for POST', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { nf } = createClient({ token: 'tok' }, mockFetch);
    await nf('POST', '/accounts/acct1/env', [{ key: 'VAR', values: [{ value: 'val', context: 'all' }] }]);
    const body = JSON.parse(captured.opts.body);
    assert.ok(Array.isArray(body));
    assert.equal(body[0].key, 'VAR');
  });

  it('does not include body for GET requests', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ([]), text: async () => '[]' };
    };
    const { nf } = createClient({ token: 'tok' }, mockFetch);
    await nf('GET', '/sites');
    assert.equal(captured.opts.body, undefined);
  });

  it('throws with status code on non-ok response', async () => {
    const mockFetch = async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({}),
    });
    const { nf } = createClient({ token: 'bad-tok' }, mockFetch);
    await assert.rejects(
      () => nf('GET', '/sites'),
      (err) => { assert.ok(err.message.includes('401')); return true; }
    );
  });

  it('throws with status 404 for not found', async () => {
    const mockFetch = async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({}),
    });
    const { nf } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => nf('GET', '/sites/no-such'),
      (err) => { assert.ok(err.message.includes('404')); return true; }
    );
  });

  it('error includes response body text', async () => {
    const mockFetch = async () => ({
      ok: false, status: 422,
      text: async () => 'Validation failed for site',
      json: async () => ({}),
    });
    const { nf } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => nf('POST', '/sites/s1/builds', {}),
      (err) => { assert.ok(err.message.includes('Validation failed for site')); return true; }
    );
  });
});

// ─── Tool structure ───────────────────────────────────────────────────────────
const allTools = [
  { name: 'get_deploy', tool: getDeploy },
  { name: 'get_site', tool: getSite },
  { name: 'list_deploys', tool: listDeploys },
  { name: 'list_env_vars', tool: listEnvVars },
  { name: 'list_forms', tool: listForms },
  { name: 'list_sites', tool: listSites },
  { name: 'list_submissions', tool: listSubmissions },
  { name: 'rollback', tool: rollback },
  { name: 'set_env_var', tool: setEnvVar },
  { name: 'trigger_build', tool: triggerBuild },
];

describe('tool structure', () => {
  for (const { name, tool } of allTools) {
    it(`${name} has a non-empty string description`, () => {
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.description.length > 0);
    });
    it(`${name} has an input object`, () => {
      assert.equal(typeof tool.input, 'object');
      assert.notEqual(tool.input, null);
    });
    it(`${name} has an execute function`, () => {
      assert.equal(typeof tool.execute, 'function');
    });
  }
});

// ─── get_deploy ───────────────────────────────────────────────────────────────
describe('get_deploy', () => {
  it('GETs /deploys/{deployId}', async () => {
    const data = { id: 'dep1', state: 'ready', ssl_url: 'https://dep1.netlify.app', created_at: new Date().toISOString() };
    const { ctx, getCaptured } = makeCtx(data);
    await getDeploy.execute({ deployId: 'dep1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/deploys/dep1'));
    assert.equal(opts.method, 'GET');
  });

  it('returns deploy ID, state, and URL', async () => {
    const data = {
      id: 'dep_abc', state: 'ready', ssl_url: 'https://dep_abc.netlify.app',
      branch: 'main', created_at: new Date().toISOString(),
    };
    const { ctx } = makeCtx(data);
    const result = await getDeploy.execute({ deployId: 'dep_abc' }, ctx);
    assert.ok(result.includes('dep_abc'));
    assert.ok(result.includes('ready'));
    assert.ok(result.includes('https://dep_abc.netlify.app'));
  });

  it('includes branch, title, commit ref, deploy time when present', async () => {
    const data = {
      id: 'dep2', state: 'ready',
      ssl_url: 'https://dep2.netlify.app',
      branch: 'feature-x', title: 'Add dark mode',
      commit_ref: 'abcdef1234567890',
      deploy_time: 42,
      created_at: new Date().toISOString(),
    };
    const { ctx } = makeCtx(data);
    const result = await getDeploy.execute({ deployId: 'dep2' }, ctx);
    assert.ok(result.includes('Branch: feature-x'));
    assert.ok(result.includes('Title: Add dark mode'));
    assert.ok(result.includes('Commit: abcdef12'));
    assert.ok(result.includes('Build time: 42s'));
  });

  it('includes error_message when present', async () => {
    const data = {
      id: 'dep3', state: 'error',
      ssl_url: null, error_message: 'Build failed: exit code 1',
      created_at: new Date().toISOString(),
    };
    const { ctx } = makeCtx(data);
    const result = await getDeploy.execute({ deployId: 'dep3' }, ctx);
    assert.ok(result.includes('Error: Build failed: exit code 1'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getDeploy.execute({ deployId: 'no-dep' }, ctx));
  });
});

// ─── get_site ─────────────────────────────────────────────────────────────────
describe('get_site', () => {
  it('GETs /sites/{siteId}', async () => {
    const data = {
      id: 'site1', name: 'my-site', url: 'https://my-site.netlify.app',
      ssl_url: 'https://my-site.netlify.app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getSite.execute({ siteId: 'site1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/sites/site1'));
    assert.equal(opts.method, 'GET');
  });

  it('returns site name, URL, and ID', async () => {
    const data = {
      id: 'site_abc', name: 'cool-site', url: 'https://cool-site.netlify.app',
      ssl_url: 'https://cool-site.netlify.app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { ctx } = makeCtx(data);
    const result = await getSite.execute({ siteId: 'site_abc' }, ctx);
    assert.ok(result.includes('cool-site'));
    assert.ok(result.includes('https://cool-site.netlify.app'));
    assert.ok(result.includes('[id: site_abc]'));
  });

  it('includes repo, branch, build command, and publish dir when present', async () => {
    const data = {
      id: 's1', name: 'app', url: 'https://app.netlify.app',
      ssl_url: 'https://app.netlify.app',
      repo: { repo_path: 'myorg/myrepo', branch: 'main' },
      build_settings: { cmd: 'npm run build', dir: 'dist' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { ctx } = makeCtx(data);
    const result = await getSite.execute({ siteId: 's1' }, ctx);
    assert.ok(result.includes('myorg/myrepo'));
    assert.ok(result.includes('Branch: main'));
    assert.ok(result.includes('Build: npm run build'));
    assert.ok(result.includes('Publish: dist'));
  });

  it('URL-encodes siteId', async () => {
    const data = {
      id: 'my site.netlify.app', name: 'my site', url: 'https://my-site.netlify.app',
      ssl_url: 'https://my-site.netlify.app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getSite.execute({ siteId: 'my site.netlify.app' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my%20site.netlify.app'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getSite.execute({ siteId: 'gone' }, ctx));
  });
});

// ─── list_deploys ─────────────────────────────────────────────────────────────
describe('list_deploys', () => {
  it('GETs /sites/{siteId}/deploys?per_page=...', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listDeploys.execute({ siteId: 's1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/sites/s1/deploys'));
    assert.ok(url.includes('per_page=10'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted deploy list', async () => {
    const data = [
      {
        id: 'abcdef1234567890', state: 'ready', branch: 'main',
        title: 'Deploy preview', deploy_time: 55,
        created_at: new Date().toISOString(),
      },
    ];
    const { ctx } = makeCtx(data);
    const result = await listDeploys.execute({ siteId: 's1' }, ctx);
    assert.ok(result.includes('abcdef12'));
    assert.ok(result.includes('ready'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('Deploy preview'));
    assert.ok(result.includes('55s'));
  });

  it('returns message when no deploys', async () => {
    const { ctx } = makeCtx([]);
    const result = await listDeploys.execute({ siteId: 's1' }, ctx);
    assert.equal(result, 'No deploys found.');
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listDeploys.execute({ siteId: 's1', limit: 3 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=3'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listDeploys.execute({ siteId: 'bad' }, ctx));
  });
});

// ─── list_env_vars ────────────────────────────────────────────────────────────
describe('list_env_vars', () => {
  it('GETs /accounts/{accountId}/env', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listEnvVars.execute({ accountId: 'acct1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acct1/env'));
    assert.equal(opts.method, 'GET');
  });

  it('appends site_id filter when siteId provided', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listEnvVars.execute({ accountId: 'acct1', siteId: 's1' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('site_id=s1'));
  });

  it('returns formatted env var list', async () => {
    const data = [
      { key: 'API_KEY', values: [{ context: 'production' }, { context: 'deploy-preview' }] },
      { key: 'DEBUG', values: [{ context: 'all' }] },
    ];
    const { ctx } = makeCtx(data);
    const result = await listEnvVars.execute({ accountId: 'acct1' }, ctx);
    assert.ok(result.includes('API_KEY'));
    assert.ok(result.includes('production'));
    assert.ok(result.includes('deploy-preview'));
    assert.ok(result.includes('DEBUG'));
  });

  it('returns message when no env vars', async () => {
    const { ctx } = makeCtx([]);
    const result = await listEnvVars.execute({ accountId: 'acct1' }, ctx);
    assert.equal(result, 'No environment variables found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => listEnvVars.execute({ accountId: 'acct1' }, ctx));
  });
});

// ─── list_forms ───────────────────────────────────────────────────────────────
describe('list_forms', () => {
  it('GETs /sites/{siteId}/forms', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listForms.execute({ siteId: 's1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/sites/s1/forms'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted form list with submission count and ID', async () => {
    const data = [
      { id: 'f1', name: 'Contact', submission_count: 42 },
      { id: 'f2', name: 'Newsletter', submission_count: 7 },
    ];
    const { ctx } = makeCtx(data);
    const result = await listForms.execute({ siteId: 's1' }, ctx);
    assert.ok(result.includes('Contact'));
    assert.ok(result.includes('42 submissions'));
    assert.ok(result.includes('[id: f1]'));
    assert.ok(result.includes('Newsletter'));
    assert.ok(result.includes('7 submissions'));
  });

  it('returns message when no forms found', async () => {
    const { ctx } = makeCtx([]);
    const result = await listForms.execute({ siteId: 's1' }, ctx);
    assert.equal(result, 'No forms found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listForms.execute({ siteId: 'bad' }, ctx));
  });
});

// ─── list_sites ───────────────────────────────────────────────────────────────
describe('list_sites', () => {
  it('GETs /sites?per_page=...', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listSites.execute({}, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/sites'));
    assert.ok(url.includes('per_page=20'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted site list with URL and branch', async () => {
    const data = [
      { id: 's1', name: 'my-site', ssl_url: 'https://my-site.netlify.app', published_deploy: { branch: 'main' } },
      { id: 's2', name: 'other', ssl_url: null, published_deploy: null },
    ];
    const { ctx } = makeCtx(data);
    const result = await listSites.execute({}, ctx);
    assert.ok(result.includes('my-site'));
    assert.ok(result.includes('https://my-site.netlify.app'));
    assert.ok(result.includes('[main]'));
    assert.ok(result.includes('[id: s1]'));
    assert.ok(result.includes('other'));
  });

  it('returns message when no sites found', async () => {
    const { ctx } = makeCtx([]);
    const result = await listSites.execute({}, ctx);
    assert.equal(result, 'No sites found.');
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listSites.execute({ limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'));
  });

  it('sends correct Authorization header', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listSites.execute({}, ctx);
    const { opts } = getCaptured();
    assert.equal(opts.headers['Authorization'], 'Bearer test-nf-token');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401);
    await assert.rejects(() => listSites.execute({}, ctx));
  });
});

// ─── list_submissions ─────────────────────────────────────────────────────────
describe('list_submissions', () => {
  it('GETs /forms/{formId}/submissions?per_page=...', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listSubmissions.execute({ formId: 'form1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/forms/form1/submissions'));
    assert.ok(url.includes('per_page=20'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted submission list with data fields', async () => {
    const data = [
      {
        created_at: new Date('2026-01-01').toISOString(),
        data: { name: 'Alice', email: 'alice@example.com', message: 'Hello' },
      },
    ];
    const { ctx } = makeCtx(data);
    const result = await listSubmissions.execute({ formId: 'form1' }, ctx);
    assert.ok(result.includes('name: Alice'));
    assert.ok(result.includes('email: alice@example.com'));
    assert.ok(result.includes('message: Hello'));
  });

  it('returns message when no submissions', async () => {
    const { ctx } = makeCtx([]);
    const result = await listSubmissions.execute({ formId: 'form1' }, ctx);
    assert.equal(result, 'No submissions found.');
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await listSubmissions.execute({ formId: 'f1', limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listSubmissions.execute({ formId: 'bad' }, ctx));
  });
});

// ─── rollback ─────────────────────────────────────────────────────────────────
describe('rollback', () => {
  it('POSTs to /sites/{siteId}/deploys/{deployId}/restore', async () => {
    const { ctx, getCaptured } = makeCtx({ state: 'ready' });
    await rollback.execute({ siteId: 's1', deployId: 'dep_old' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/sites/s1/deploys/dep_old/restore'));
    assert.equal(opts.method, 'POST');
  });

  it('returns success message with deploy ID and state', async () => {
    const { ctx } = makeCtx({ state: 'ready' });
    const result = await rollback.execute({ siteId: 's1', deployId: 'dep_xyz' }, ctx);
    assert.ok(result.includes('dep_xyz'));
    assert.ok(result.includes('ready'));
  });

  it('URL-encodes siteId', async () => {
    const { ctx, getCaptured } = makeCtx({ state: 'ready' });
    await rollback.execute({ siteId: 'my site', deployId: 'dep1' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my%20site'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => rollback.execute({ siteId: 'bad', deployId: 'dep1' }, ctx));
  });
});

// ─── set_env_var ──────────────────────────────────────────────────────────────
describe('set_env_var', () => {
  it('POSTs to /accounts/{accountId}/env', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await setEnvVar.execute({ accountId: 'acct1', key: 'API_KEY', value: 'secret123' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acct1/env'));
    assert.equal(opts.method, 'POST');
  });

  it('sends correct body with key, scopes, and values', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await setEnvVar.execute({ accountId: 'acct1', key: 'MY_VAR', value: 'my_val', context: 'production' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(Array.isArray(body));
    assert.equal(body[0].key, 'MY_VAR');
    assert.deepEqual(body[0].scopes, ['builds', 'functions', 'runtime', 'post_processing']);
    assert.deepEqual(body[0].values, [{ value: 'my_val', context: 'production' }]);
  });

  it('defaults context to "all" when not specified', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await setEnvVar.execute({ accountId: 'acct1', key: 'K', value: 'v' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body[0].values[0].context, 'all');
  });

  it('returns success message with key and context', async () => {
    const { ctx } = makeCtx([]);
    const result = await setEnvVar.execute({ accountId: 'acct1', key: 'NODE_ENV', value: 'production', context: 'production' }, ctx);
    assert.ok(result.includes('NODE_ENV'));
    assert.ok(result.includes('production'));
  });

  it('URL-encodes accountId', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await setEnvVar.execute({ accountId: 'my account', key: 'K', value: 'v' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my%20account'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(422);
    await assert.rejects(() => setEnvVar.execute({ accountId: 'acct1', key: 'K', value: 'v' }, ctx));
  });
});

// ─── trigger_build ────────────────────────────────────────────────────────────
describe('trigger_build', () => {
  it('POSTs to /sites/{siteId}/builds', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'build1', done: false });
    await triggerBuild.execute({ siteId: 's1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/sites/s1/builds'));
    assert.equal(opts.method, 'POST');
  });

  it('returns success message with build ID and state', async () => {
    const { ctx } = makeCtx({ id: 'build_abc', done: false });
    const result = await triggerBuild.execute({ siteId: 's1' }, ctx);
    assert.ok(result.includes('build_abc'));
    assert.ok(result.includes('building'));
  });

  it('shows "done" when build is already done', async () => {
    const { ctx } = makeCtx({ id: 'build_done', done: true });
    const result = await triggerBuild.execute({ siteId: 's1' }, ctx);
    assert.ok(result.includes('done'));
  });

  it('URL-encodes siteId', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'b1', done: false });
    await triggerBuild.execute({ siteId: 'my site' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my%20site'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => triggerBuild.execute({ siteId: 'bad' }, ctx));
  });
});
