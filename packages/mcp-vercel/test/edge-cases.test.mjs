import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'vercel.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

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
// Pagination — limit param
// ---------------------------------------------------------------------------
describe('vercel pagination defaults', () => {
  it('vercel_list_projects uses default limit of 20', async () => {
    mockFetch(200, { projects: [] });
    await getTool('vercel_list_projects').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('vercel_list_projects respects custom limit', async () => {
    mockFetch(200, { projects: [] });
    await getTool('vercel_list_projects').handler({ limit: 5 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=5'));
  });

  it('vercel_list_deployments uses default limit of 10', async () => {
    mockFetch(200, { deployments: [] });
    await getTool('vercel_list_deployments').handler({ project: 'p1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=10'));
  });

  it('vercel_list_deployments respects custom limit', async () => {
    mockFetch(200, { deployments: [] });
    await getTool('vercel_list_deployments').handler({ project: 'p1', limit: 3 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=3'));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted from request
// ---------------------------------------------------------------------------
describe('vercel optional params omitted', () => {
  it('vercel_list_deployments omits state filter when not provided', async () => {
    mockFetch(200, { deployments: [] });
    await getTool('vercel_list_deployments').handler({ project: 'p1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(!url.includes('state='));
  });

  it('vercel_list_deployments includes state filter when provided', async () => {
    mockFetch(200, { deployments: [] });
    await getTool('vercel_list_deployments').handler({ project: 'p1', state: 'READY' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('state=READY'));
  });

  it('vercel_create_env_var defaults type to encrypted', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({ project: 'p1', key: 'K', value: 'V' });
    assert.equal(capturedBody.type, 'encrypted');
  });

  it('vercel_create_env_var defaults target to all environments', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({ project: 'p1', key: 'K', value: 'V' });
    assert.deepEqual(capturedBody.target, ['production', 'preview', 'development']);
  });

  it('vercel_create_env_var uses custom target when provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({ project: 'p1', key: 'K', value: 'V', target: 'production' });
    assert.deepEqual(capturedBody.target, ['production']);
  });

  it('vercel_create_env_var splits comma-separated targets', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({ project: 'p1', key: 'K', value: 'V', target: 'production, preview' });
    assert.deepEqual(capturedBody.target, ['production', 'preview']);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('vercel error responses', () => {
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

  it('throws on 404 not found', async () => {
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

  it('throws on 429 rate limited', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 429,
      text: async () => 'Too Many Requests',
      json: async () => ({ error: { message: 'Rate limited' } }),
    }));
    await assert.rejects(
      () => getTool('vercel_list_deployments').handler({ project: 'p1' }),
      (err) => {
        assert.ok(err.message.includes('Vercel API 429'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ error: { message: 'Server Error' } }),
    }));
    await assert.rejects(
      () => getTool('vercel_redeploy').handler({ deploymentId: 'dpl_1' }),
      (err) => {
        assert.ok(err.message.includes('Vercel API 500'));
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Empty result sets
// ---------------------------------------------------------------------------
describe('vercel empty results', () => {
  it('vercel_list_projects returns message on empty projects', async () => {
    mockFetch(200, { projects: [] });
    const result = await getTool('vercel_list_projects').handler({});
    assert.equal(result, 'No projects found.');
  });

  it('vercel_list_projects returns message on null projects', async () => {
    mockFetch(200, { projects: null });
    const result = await getTool('vercel_list_projects').handler({});
    assert.equal(result, 'No projects found.');
  });

  it('vercel_list_deployments returns message on empty deployments', async () => {
    mockFetch(200, { deployments: [] });
    const result = await getTool('vercel_list_deployments').handler({ project: 'p1' });
    assert.equal(result, 'No deployments found.');
  });

  it('vercel_list_domains returns message on empty domains', async () => {
    mockFetch(200, { domains: [] });
    const result = await getTool('vercel_list_domains').handler({ project: 'p1' });
    assert.equal(result, 'No domains found.');
  });

  it('vercel_list_env_vars returns message on empty envs', async () => {
    mockFetch(200, { envs: [] });
    const result = await getTool('vercel_list_env_vars').handler({ project: 'p1' });
    assert.equal(result, 'No environment variables found.');
  });

  it('vercel_get_deployment_events returns message on empty array', async () => {
    mockFetch(200, []);
    const result = await getTool('vercel_get_deployment_events').handler({ deploymentId: 'dpl_1' });
    assert.equal(result, 'No events found.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in input strings
// ---------------------------------------------------------------------------
describe('vercel special characters in inputs', () => {
  it('vercel_create_env_var passes special chars in value', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({
      project: 'p1', key: 'DSN', value: 'postgres://user:p@ss&word@host:5432/db?ssl=true&mode="verify"',
    });
    assert.equal(capturedBody.value, 'postgres://user:p@ss&word@host:5432/db?ssl=true&mode="verify"');
  });
});

// ---------------------------------------------------------------------------
// URL encoding of path parameters
// ---------------------------------------------------------------------------
describe('vercel URL encoding', () => {
  it('vercel_get_project encodes project name in URL', async () => {
    mockFetch(200, {
      name: 'my-app', framework: null, id: 'p1',
      createdAt: 0, updatedAt: 0,
    });
    await getTool('vercel_get_project').handler({ project: 'my-app' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v9/projects/my-app'));
  });

  it('vercel_list_domains encodes project in URL', async () => {
    mockFetch(200, { domains: [] });
    await getTool('vercel_list_domains').handler({ project: 'my-app' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v9/projects/my-app/domains'));
  });

  it('vercel_list_env_vars encodes project in URL', async () => {
    mockFetch(200, { envs: [] });
    await getTool('vercel_list_env_vars').handler({ project: 'my-app' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v9/projects/my-app/env'));
  });

  it('vercel_create_env_var encodes project in URL', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      json: async () => ({}),
      text: async () => '{}',
    }));
    await getTool('vercel_create_env_var').handler({ project: 'my-app', key: 'K', value: 'V' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v10/projects/my-app/env'));
  });

  it('vercel_get_deployment encodes deploymentId in URL', async () => {
    mockFetch(200, {
      url: 'test.vercel.app', readyState: 'READY', name: 'test',
      createdAt: 0,
    });
    await getTool('vercel_get_deployment').handler({ deploymentId: 'dpl_abc123' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v13/deployments/dpl_abc123'));
  });

  it('vercel_get_deployment_events encodes deploymentId in URL', async () => {
    mockFetch(200, []);
    await getTool('vercel_get_deployment_events').handler({ deploymentId: 'dpl_abc123' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/v3/deployments/dpl_abc123/events'));
  });

  it('vercel_list_deployments encodes projectId in query string', async () => {
    mockFetch(200, { deployments: [] });
    await getTool('vercel_list_deployments').handler({ project: 'my-app' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('projectId=my-app'));
  });
});

// ---------------------------------------------------------------------------
// Complex input schemas
// ---------------------------------------------------------------------------
describe('vercel complex inputs', () => {
  it('vercel_create_env_var sends full body with all params', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({
      project: 'p1', key: 'SECRET', value: 'val', target: 'production,preview', type: 'secret',
    });
    assert.equal(capturedBody.key, 'SECRET');
    assert.equal(capturedBody.value, 'val');
    assert.equal(capturedBody.type, 'secret');
    assert.deepEqual(capturedBody.target, ['production', 'preview']);
  });

  it('vercel_redeploy sends deploymentId and target in body', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ url: 'test.vercel.app', readyState: 'BUILDING' }),
        text: async () => '{}',
      };
    });
    await getTool('vercel_redeploy').handler({ deploymentId: 'dpl_old' });
    assert.equal(capturedBody.deploymentId, 'dpl_old');
    assert.equal(capturedBody.target, 'production');
  });

  it('vercel_get_deployment_events limits to last 30 events', async () => {
    const events = Array.from({ length: 50 }, (_, i) => ({ created: 1700000000000 + i * 1000, text: `Event ${i}` }));
    mockFetch(200, events);
    const result = await getTool('vercel_get_deployment_events').handler({ deploymentId: 'dpl_1' });
    const lines = result.split('\n');
    assert.equal(lines.length, 30);
    assert.ok(result.includes('Event 20'));
    assert.ok(result.includes('Event 49'));
    assert.ok(!result.includes('Event 19'));
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
describe('vercel default values', () => {
  it('vercel_list_projects defaults limit to 20', async () => {
    mockFetch(200, { projects: [] });
    await getTool('vercel_list_projects').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('vercel_list_deployments defaults limit to 10', async () => {
    mockFetch(200, { deployments: [] });
    await getTool('vercel_list_deployments').handler({ project: 'p1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=10'));
  });

  it('vercel_create_env_var defaults type to encrypted', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('vercel_create_env_var').handler({ project: 'p1', key: 'A', value: 'B' });
    assert.equal(capturedBody.type, 'encrypted');
  });
});
