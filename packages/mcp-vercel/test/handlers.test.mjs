import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'vercel.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

let tools;
let toolMap;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ token: 'test-fake-token' }));

  const mod = await import('../connectors/vercel.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
});

after(() => {
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

function getTool(name) {
  return toolMap[name];
}

function mockFetch(status, body) {
  mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

// ---------------------------------------------------------------------------
// vercel_list_projects
// ---------------------------------------------------------------------------
describe('vercel_list_projects handler', () => {
  it('returns formatted project list', async () => {
    mockFetch(200, {
      projects: [
        { name: 'my-app', framework: 'nextjs', id: 'p1' },
        { name: 'docs-site', framework: null, id: 'p2' },
      ]
    });
    const result = await getTool('vercel_list_projects').handler({});
    assert.ok(result.includes('my-app'));
    assert.ok(result.includes('[nextjs]'));
    assert.ok(result.includes('[id: p1]'));
    assert.ok(result.includes('docs-site'));
  });

  it('returns message when no projects', async () => {
    mockFetch(200, { projects: [] });
    const result = await getTool('vercel_list_projects').handler({});
    assert.equal(result, 'No projects found.');
  });

  it('sends Bearer token header', async () => {
    mockFetch(200, { projects: [] });
    await getTool('vercel_list_projects').handler({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.headers['Authorization'], 'Bearer test-fake-token');
  });
});

// ---------------------------------------------------------------------------
// vercel_get_project
// ---------------------------------------------------------------------------
describe('vercel_get_project handler', () => {
  it('returns formatted project details', async () => {
    mockFetch(200, {
      name: 'my-app', framework: 'nextjs', id: 'p1',
      link: { type: 'github', org: 'myorg', repo: 'my-app' },
      createdAt: 1700000000000, updatedAt: 1710000000000,
      targets: { production: { url: 'my-app.vercel.app' } },
    });
    const result = await getTool('vercel_get_project').handler({ project: 'my-app' });
    assert.ok(result.includes('my-app'));
    assert.ok(result.includes('[nextjs]'));
    assert.ok(result.includes('myorg/my-app'));
    assert.ok(result.includes('https://my-app.vercel.app'));
    assert.ok(result.includes('[id: p1]'));
  });

  it('calls correct API path', async () => {
    mockFetch(200, {
      name: 'test', framework: null, id: 'p1',
      createdAt: 0, updatedAt: 0,
    });
    await getTool('vercel_get_project').handler({ project: 'test' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v9/projects/test'));
  });
});

// ---------------------------------------------------------------------------
// vercel_list_deployments
// ---------------------------------------------------------------------------
describe('vercel_list_deployments handler', () => {
  it('returns formatted deployment list', async () => {
    mockFetch(200, {
      deployments: [
        { url: 'my-app-abc.vercel.app', state: 'READY', created: 1700000000000, meta: { githubCommitMessage: 'fix bug' } },
      ]
    });
    const result = await getTool('vercel_list_deployments').handler({ project: 'p1' });
    assert.ok(result.includes('my-app-abc.vercel.app'));
    assert.ok(result.includes('READY'));
    assert.ok(result.includes('fix bug'));
  });

  it('returns message when no deployments', async () => {
    mockFetch(200, { deployments: [] });
    const result = await getTool('vercel_list_deployments').handler({ project: 'p1' });
    assert.equal(result, 'No deployments found.');
  });
});

// ---------------------------------------------------------------------------
// vercel_get_deployment
// ---------------------------------------------------------------------------
describe('vercel_get_deployment handler', () => {
  it('returns formatted deployment details', async () => {
    mockFetch(200, {
      url: 'my-app-abc.vercel.app', readyState: 'READY', name: 'my-app',
      meta: { githubCommitMessage: 'update docs', githubCommitRef: 'main' },
      createdAt: 1700000000000, ready: 1700000010000, target: 'production',
    });
    const result = await getTool('vercel_get_deployment').handler({ deploymentId: 'dpl_123' });
    assert.ok(result.includes('my-app-abc.vercel.app'));
    assert.ok(result.includes('READY'));
    assert.ok(result.includes('update docs'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('production'));
  });
});

// ---------------------------------------------------------------------------
// vercel_list_domains
// ---------------------------------------------------------------------------
describe('vercel_list_domains handler', () => {
  it('returns formatted domain list', async () => {
    mockFetch(200, {
      domains: [
        { name: 'example.com', verified: true },
        { name: 'www.example.com', redirect: 'example.com', verified: false },
      ]
    });
    const result = await getTool('vercel_list_domains').handler({ project: 'p1' });
    assert.ok(result.includes('example.com'));
    assert.ok(result.includes('[verified]'));
    assert.ok(result.includes('www.example.com'));
    assert.ok(result.includes('[unverified]'));
  });

  it('returns message when no domains', async () => {
    mockFetch(200, { domains: [] });
    const result = await getTool('vercel_list_domains').handler({ project: 'p1' });
    assert.equal(result, 'No domains found.');
  });
});

// ---------------------------------------------------------------------------
// vercel_list_env_vars
// ---------------------------------------------------------------------------
describe('vercel_list_env_vars handler', () => {
  it('returns formatted env var list', async () => {
    mockFetch(200, {
      envs: [
        { key: 'API_KEY', type: 'encrypted', target: ['production', 'preview'] },
      ]
    });
    const result = await getTool('vercel_list_env_vars').handler({ project: 'p1' });
    assert.ok(result.includes('API_KEY'));
    assert.ok(result.includes('[encrypted]'));
    assert.ok(result.includes('production, preview'));
  });

  it('returns message when no env vars', async () => {
    mockFetch(200, { envs: [] });
    const result = await getTool('vercel_list_env_vars').handler({ project: 'p1' });
    assert.equal(result, 'No environment variables found.');
  });
});

// ---------------------------------------------------------------------------
// vercel_create_env_var
// ---------------------------------------------------------------------------
describe('vercel_create_env_var handler', () => {
  it('creates env var and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    const result = await getTool('vercel_create_env_var').handler({
      project: 'p1', key: 'SECRET', value: 'abc123', target: 'production'
    });
    assert.ok(result.includes('SECRET'));
    assert.ok(result.includes('production'));
    assert.equal(capturedBody.key, 'SECRET');
    assert.equal(capturedBody.value, 'abc123');
  });
});

// ---------------------------------------------------------------------------
// vercel_redeploy
// ---------------------------------------------------------------------------
describe('vercel_redeploy handler', () => {
  it('triggers redeployment and returns result', async () => {
    mockFetch(200, { url: 'my-app-new.vercel.app', readyState: 'BUILDING' });
    const result = await getTool('vercel_redeploy').handler({ deploymentId: 'dpl_123' });
    assert.ok(result.includes('Redeployment triggered'));
    assert.ok(result.includes('my-app-new.vercel.app'));
    assert.ok(result.includes('BUILDING'));
  });
});

// ---------------------------------------------------------------------------
// vercel_get_deployment_events
// ---------------------------------------------------------------------------
describe('vercel_get_deployment_events handler', () => {
  it('returns formatted events', async () => {
    mockFetch(200, [
      { created: 1700000000000, text: 'Building...' },
      { created: 1700000001000, text: 'Done' },
    ]);
    const result = await getTool('vercel_get_deployment_events').handler({ deploymentId: 'dpl_123' });
    assert.ok(result.includes('Building...'));
    assert.ok(result.includes('Done'));
  });

  it('returns message when no events', async () => {
    mockFetch(200, []);
    const result = await getTool('vercel_get_deployment_events').handler({ deploymentId: 'dpl_123' });
    assert.equal(result, 'No events found.');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('vercel error handling', () => {
  it('throws on 404 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ error: { message: 'Not Found' } }),
    }));
    await assert.rejects(
      () => getTool('vercel_get_project').handler({ project: 'ghost' }),
      (err) => {
        assert.ok(err.message.includes('Vercel API 404'));
        return true;
      }
    );
  });

  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({ error: { message: 'Unauthorized' } }),
    }));
    await assert.rejects(
      () => getTool('vercel_list_projects').handler({}),
      (err) => {
        assert.ok(err.message.includes('Vercel API 401'));
        return true;
      }
    );
  });
});
