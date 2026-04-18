/**
 * Comprehensive unit tests for mcp-vercel tools and lib/client.mjs
 * Uses Node.js built-in test runner (node:test) with mocked ctx pattern.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '../lib/client.mjs';

// ─── Tool imports ────────────────────────────────────────────────────────────
import createEnvVar from '../tools/create_env_var.mjs';
import getDeployment from '../tools/get_deployment.mjs';
import getDeploymentEvents from '../tools/get_deployment_events.mjs';
import getProject from '../tools/get_project.mjs';
import listDeployments from '../tools/list_deployments.mjs';
import listDomains from '../tools/list_domains.mjs';
import listEnvVars from '../tools/list_env_vars.mjs';
import listProjects from '../tools/list_projects.mjs';
import redeploy from '../tools/redeploy.mjs';

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
    ctx: { credentials: { token: 'test-vc-token' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts }),
    getAllCalls: () => allCalls,
  };
}

function makeErrCtx(status) {
  const fetch = async () => ({
    ok: false,
    status,
    text: async () => `Error ${status}`,
    json: async () => ({ error: { message: `Error ${status}` } }),
  });
  return { ctx: { credentials: { token: 'test-vc-token' }, fetch } };
}

// ─── lib/client.mjs ──────────────────────────────────────────────────────────
describe('createClient (vercel)', () => {
  it('routes through provided fetchFn with correct URL prefix', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ projects: [] }), text: async () => '{}' };
    };
    const { vc } = createClient({ token: 'tok-vc' }, mockFetch);
    await vc('GET', '/v9/projects');
    assert.ok(captured.url.startsWith('https://api.vercel.com'));
    assert.ok(captured.url.includes('/v9/projects'));
  });

  it('sends Authorization: Bearer {token} header', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { vc } = createClient({ token: 'vercel-tok-xyz' }, mockFetch);
    await vc('GET', '/v9/projects');
    assert.equal(captured.opts.headers['Authorization'], 'Bearer vercel-tok-xyz');
  });

  it('sends Content-Type application/json', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { vc } = createClient({ token: 'tok' }, mockFetch);
    await vc('POST', '/v10/projects/my-project/env', { key: 'VAR', value: 'val', type: 'encrypted', target: ['production'] });
    assert.equal(captured.opts.headers['Content-Type'], 'application/json');
  });

  it('serializes body as JSON string for POST', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { vc } = createClient({ token: 'tok' }, mockFetch);
    await vc('POST', '/v13/deployments?forceNew=1', { deploymentId: 'dep1', target: 'production' });
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.deploymentId, 'dep1');
    assert.equal(body.target, 'production');
  });

  it('does not include body for GET requests', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { vc } = createClient({ token: 'tok' }, mockFetch);
    await vc('GET', '/v9/projects');
    assert.equal(captured.opts.body, undefined);
  });

  it('throws with status code on non-ok response', async () => {
    const mockFetch = async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({}),
    });
    const { vc } = createClient({ token: 'bad-tok' }, mockFetch);
    await assert.rejects(
      () => vc('GET', '/v9/projects'),
      (err) => { assert.ok(err.message.includes('401')); return true; }
    );
  });

  it('throws with status 404 for not found', async () => {
    const mockFetch = async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({}),
    });
    const { vc } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => vc('GET', '/v9/projects/no-such'),
      (err) => { assert.ok(err.message.includes('404')); return true; }
    );
  });

  it('error includes response body text', async () => {
    const mockFetch = async () => ({
      ok: false, status: 403,
      text: async () => 'You do not have access',
      json: async () => ({}),
    });
    const { vc } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => vc('GET', '/v9/projects'),
      (err) => { assert.ok(err.message.includes('You do not have access')); return true; }
    );
  });
});

// ─── Tool structure ───────────────────────────────────────────────────────────
const allTools = [
  { name: 'create_env_var', tool: createEnvVar },
  { name: 'get_deployment', tool: getDeployment },
  { name: 'get_deployment_events', tool: getDeploymentEvents },
  { name: 'get_project', tool: getProject },
  { name: 'list_deployments', tool: listDeployments },
  { name: 'list_domains', tool: listDomains },
  { name: 'list_env_vars', tool: listEnvVars },
  { name: 'list_projects', tool: listProjects },
  { name: 'redeploy', tool: redeploy },
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

// ─── create_env_var ───────────────────────────────────────────────────────────
describe('create_env_var', () => {
  it('POSTs to /v10/projects/{project}/env', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await createEnvVar.execute({ project: 'my-app', key: 'API_URL', value: 'https://api.example.com' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v10/projects/my-app/env'));
    assert.equal(opts.method, 'POST');
  });

  it('sends key, value, type, and target in body', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await createEnvVar.execute({
      project: 'my-app', key: 'DB_URL', value: 'postgres://...', type: 'encrypted', target: 'production',
    }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.key, 'DB_URL');
    assert.equal(body.value, 'postgres://...');
    assert.equal(body.type, 'encrypted');
    assert.deepEqual(body.target, ['production']);
  });

  it('defaults to all targets when target not specified', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await createEnvVar.execute({ project: 'app', key: 'KEY', value: 'val' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.target, ['production', 'preview', 'development']);
  });

  it('splits comma-separated target string', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await createEnvVar.execute({ project: 'app', key: 'K', value: 'v', target: 'production, preview' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.target, ['production', 'preview']);
  });

  it('returns success message with key and targets', async () => {
    const { ctx } = makeCtx({});
    const result = await createEnvVar.execute({ project: 'app', key: 'MY_VAR', value: 'val', target: 'production' }, ctx);
    assert.ok(result.includes('MY_VAR'));
    assert.ok(result.includes('production'));
  });

  it('URL-encodes project name with spaces', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await createEnvVar.execute({ project: 'my app', key: 'K', value: 'v' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my%20app'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(409);
    await assert.rejects(() => createEnvVar.execute({ project: 'app', key: 'K', value: 'v' }, ctx));
  });
});

// ─── get_deployment ───────────────────────────────────────────────────────────
describe('get_deployment', () => {
  it('GETs /v13/deployments/{deploymentId}', async () => {
    const data = {
      url: 'my-app-abc.vercel.app', readyState: 'READY', name: 'my-app',
      createdAt: Date.now(), ready: Date.now(), target: 'production', meta: {},
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getDeployment.execute({ deploymentId: 'dpl_abc123' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v13/deployments/dpl_abc123'));
    assert.equal(opts.method, 'GET');
  });

  it('returns URL, state, project name, and created time', async () => {
    const now = Date.now();
    const data = {
      url: 'my-app-xyz.vercel.app', readyState: 'READY', name: 'my-app',
      createdAt: now, ready: null, target: 'production', meta: {},
    };
    const { ctx } = makeCtx(data);
    const result = await getDeployment.execute({ deploymentId: 'dpl_xyz' }, ctx);
    assert.ok(result.includes('my-app-xyz.vercel.app'));
    assert.ok(result.includes('READY'));
    assert.ok(result.includes('my-app'));
    assert.ok(result.includes('production'));
  });

  it('includes commit message and branch when present in meta', async () => {
    const data = {
      url: 'app.vercel.app', readyState: 'READY', name: 'app',
      createdAt: Date.now(), ready: Date.now(), target: 'production',
      meta: { githubCommitMessage: 'Fix navbar', githubCommitRef: 'main' },
    };
    const { ctx } = makeCtx(data);
    const result = await getDeployment.execute({ deploymentId: 'dpl_1' }, ctx);
    assert.ok(result.includes('Fix navbar'));
    assert.ok(result.includes('main'));
  });

  it('URL-encodes deployment ID', async () => {
    const data = {
      url: 'x.vercel.app', readyState: 'BUILDING', name: 'x',
      createdAt: Date.now(), meta: {},
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getDeployment.execute({ deploymentId: 'https://my-app.vercel.app' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('https%3A%2F%2F'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getDeployment.execute({ deploymentId: 'no-dpl' }, ctx));
  });
});

// ─── get_deployment_events ────────────────────────────────────────────────────
describe('get_deployment_events', () => {
  it('GETs /v3/deployments/{deploymentId}/events', async () => {
    const { ctx, getCaptured } = makeCtx([]);
    await getDeploymentEvents.execute({ deploymentId: 'dpl_abc' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v3/deployments/dpl_abc/events'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted event lines with time and text', async () => {
    const events = [
      { created: Date.now() - 5000, text: 'Installing dependencies...' },
      { created: Date.now() - 3000, text: 'Build complete' },
    ];
    const { ctx } = makeCtx(events);
    const result = await getDeploymentEvents.execute({ deploymentId: 'dpl_1' }, ctx);
    assert.ok(result.includes('Installing dependencies...'));
    assert.ok(result.includes('Build complete'));
  });

  it('returns message when no events', async () => {
    const { ctx } = makeCtx([]);
    const result = await getDeploymentEvents.execute({ deploymentId: 'dpl_empty' }, ctx);
    assert.equal(result, 'No events found.');
  });

  it('uses payload.text when text is missing', async () => {
    const events = [{ created: Date.now(), payload: { text: 'Starting build' } }];
    const { ctx } = makeCtx(events);
    const result = await getDeploymentEvents.execute({ deploymentId: 'dpl_1' }, ctx);
    assert.ok(result.includes('Starting build'));
  });

  it('returns last 30 events when more than 30 exist', async () => {
    const events = Array.from({ length: 40 }, (_, i) => ({ created: Date.now() + i, text: `Event ${i}` }));
    const { ctx } = makeCtx(events);
    const result = await getDeploymentEvents.execute({ deploymentId: 'dpl_1' }, ctx);
    const lines = result.trim().split('\n');
    assert.equal(lines.length, 30);
    assert.ok(result.includes('Event 10')); // starts from index 10
    assert.ok(result.includes('Event 39')); // ends at last
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getDeploymentEvents.execute({ deploymentId: 'gone' }, ctx));
  });
});

// ─── get_project ─────────────────────────────────────────────────────────────
describe('get_project', () => {
  it('GETs /v9/projects/{project}', async () => {
    const data = {
      id: 'prj_1', name: 'my-app', framework: 'nextjs',
      createdAt: Date.now(), updatedAt: Date.now(), link: null, targets: {},
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getProject.execute({ project: 'my-app' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v9/projects/my-app'));
    assert.equal(opts.method, 'GET');
  });

  it('returns project name, framework, and ID', async () => {
    const data = {
      id: 'prj_abc', name: 'cool-app', framework: 'gatsby',
      createdAt: Date.now(), updatedAt: Date.now(), link: null, targets: {},
    };
    const { ctx } = makeCtx(data);
    const result = await getProject.execute({ project: 'cool-app' }, ctx);
    assert.ok(result.includes('cool-app'));
    assert.ok(result.includes('gatsby'));
    assert.ok(result.includes('[id: prj_abc]'));
  });

  it('includes repo link when present', async () => {
    const data = {
      id: 'prj_1', name: 'app', framework: 'nextjs',
      createdAt: Date.now(), updatedAt: Date.now(),
      link: { type: 'github', org: 'myorg', repo: 'my-repo' },
      targets: {},
    };
    const { ctx } = makeCtx(data);
    const result = await getProject.execute({ project: 'app' }, ctx);
    assert.ok(result.includes('github'));
    assert.ok(result.includes('myorg/my-repo'));
  });

  it('includes production URL when present', async () => {
    const data = {
      id: 'prj_2', name: 'app', framework: null,
      createdAt: Date.now(), updatedAt: Date.now(), link: null,
      targets: { production: { url: 'app.vercel.app' } },
    };
    const { ctx } = makeCtx(data);
    const result = await getProject.execute({ project: 'app' }, ctx);
    assert.ok(result.includes('https://app.vercel.app'));
  });

  it('URL-encodes project name', async () => {
    const data = {
      id: 'prj_3', name: 'my app', framework: null,
      createdAt: Date.now(), updatedAt: Date.now(), link: null, targets: {},
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getProject.execute({ project: 'my app' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my%20app'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getProject.execute({ project: 'gone' }, ctx));
  });
});

// ─── list_deployments ─────────────────────────────────────────────────────────
describe('list_deployments', () => {
  it('GETs /v6/deployments?projectId=...&limit=...', async () => {
    const { ctx, getCaptured } = makeCtx({ deployments: [] });
    await listDeployments.execute({ project: 'my-app' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v6/deployments'));
    assert.ok(url.includes('projectId=my-app'));
    assert.ok(url.includes('limit=10'));
    assert.equal(opts.method, 'GET');
  });

  it('appends state filter when provided', async () => {
    const { ctx, getCaptured } = makeCtx({ deployments: [] });
    await listDeployments.execute({ project: 'app', state: 'READY' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('state=READY'));
  });

  it('returns formatted deployment list', async () => {
    const data = {
      deployments: [
        {
          uid: 'dpl_1', url: 'app-abc.vercel.app', state: 'READY',
          created: Date.now(), meta: { githubCommitMessage: 'Add dark mode' },
        },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listDeployments.execute({ project: 'app' }, ctx);
    assert.ok(result.includes('app-abc.vercel.app'));
    assert.ok(result.includes('READY'));
    assert.ok(result.includes('Add dark mode'));
  });

  it('returns message when no deployments', async () => {
    const { ctx } = makeCtx({ deployments: [] });
    const result = await listDeployments.execute({ project: 'app' }, ctx);
    assert.equal(result, 'No deployments found.');
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx({ deployments: [] });
    await listDeployments.execute({ project: 'app', limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('limit=5'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => listDeployments.execute({ project: 'app' }, ctx));
  });
});

// ─── list_domains ─────────────────────────────────────────────────────────────
describe('list_domains', () => {
  it('GETs /v9/projects/{project}/domains', async () => {
    const { ctx, getCaptured } = makeCtx({ domains: [] });
    await listDomains.execute({ project: 'my-app' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v9/projects/my-app/domains'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted domain list with verified status', async () => {
    const data = {
      domains: [
        { name: 'example.com', redirect: null, verified: true },
        { name: 'www.example.com', redirect: 'example.com', verified: false },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listDomains.execute({ project: 'app' }, ctx);
    assert.ok(result.includes('example.com'));
    assert.ok(result.includes('[verified]'));
    assert.ok(result.includes('www.example.com'));
    assert.ok(result.includes('[unverified]'));
  });

  it('shows redirect arrow when redirect present', async () => {
    const data = { domains: [{ name: 'old.com', redirect: 'new.com', verified: true }] };
    const { ctx } = makeCtx(data);
    const result = await listDomains.execute({ project: 'app' }, ctx);
    assert.ok(result.includes('new.com'));
  });

  it('returns message when no domains', async () => {
    const { ctx } = makeCtx({ domains: [] });
    const result = await listDomains.execute({ project: 'app' }, ctx);
    assert.equal(result, 'No domains found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listDomains.execute({ project: 'gone' }, ctx));
  });
});

// ─── list_env_vars ────────────────────────────────────────────────────────────
describe('list_env_vars', () => {
  it('GETs /v9/projects/{project}/env', async () => {
    const { ctx, getCaptured } = makeCtx({ envs: [] });
    await listEnvVars.execute({ project: 'my-app' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v9/projects/my-app/env'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted env var list with type and targets', async () => {
    const data = {
      envs: [
        { key: 'API_URL', type: 'encrypted', target: ['production', 'preview'] },
        { key: 'DEBUG', type: 'plain', target: ['development'] },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listEnvVars.execute({ project: 'app' }, ctx);
    assert.ok(result.includes('API_URL'));
    assert.ok(result.includes('[encrypted]'));
    assert.ok(result.includes('production, preview'));
    assert.ok(result.includes('DEBUG'));
    assert.ok(result.includes('[plain]'));
  });

  it('returns message when no env vars', async () => {
    const { ctx } = makeCtx({ envs: [] });
    const result = await listEnvVars.execute({ project: 'app' }, ctx);
    assert.equal(result, 'No environment variables found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => listEnvVars.execute({ project: 'app' }, ctx));
  });
});

// ─── list_projects ────────────────────────────────────────────────────────────
describe('list_projects', () => {
  it('GETs /v9/projects?limit=...', async () => {
    const { ctx, getCaptured } = makeCtx({ projects: [] });
    await listProjects.execute({}, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v9/projects'));
    assert.ok(url.includes('limit=20'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted project list with framework and ID', async () => {
    const data = {
      projects: [
        { id: 'prj_1', name: 'web', framework: 'nextjs' },
        { id: 'prj_2', name: 'api', framework: null },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listProjects.execute({}, ctx);
    assert.ok(result.includes('web'));
    assert.ok(result.includes('[nextjs]'));
    assert.ok(result.includes('[id: prj_1]'));
    assert.ok(result.includes('api'));
    assert.ok(result.includes('[id: prj_2]'));
  });

  it('returns message when no projects found', async () => {
    const { ctx } = makeCtx({ projects: [] });
    const result = await listProjects.execute({}, ctx);
    assert.equal(result, 'No projects found.');
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx({ projects: [] });
    await listProjects.execute({ limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('limit=5'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401);
    await assert.rejects(() => listProjects.execute({}, ctx));
  });
});

// ─── redeploy ─────────────────────────────────────────────────────────────────
describe('redeploy', () => {
  it('POSTs to /v13/deployments?forceNew=1', async () => {
    const data = { url: 'app-new.vercel.app', readyState: 'BUILDING' };
    const { ctx, getCaptured } = makeCtx(data);
    await redeploy.execute({ deploymentId: 'dpl_old' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/v13/deployments'));
    assert.ok(url.includes('forceNew=1'));
    assert.equal(opts.method, 'POST');
  });

  it('sends deploymentId and target=production in body', async () => {
    const data = { url: 'app-new.vercel.app', readyState: 'QUEUED' };
    const { ctx, getCaptured } = makeCtx(data);
    await redeploy.execute({ deploymentId: 'dpl_abc' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.deploymentId, 'dpl_abc');
    assert.equal(body.target, 'production');
  });

  it('returns success message with new deployment URL and state', async () => {
    const data = { url: 'app-def.vercel.app', readyState: 'BUILDING' };
    const { ctx } = makeCtx(data);
    const result = await redeploy.execute({ deploymentId: 'dpl_old' }, ctx);
    assert.ok(result.includes('app-def.vercel.app'));
    assert.ok(result.includes('BUILDING'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => redeploy.execute({ deploymentId: 'no-dpl' }, ctx));
  });
});
