import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'netlify.json');
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

  const mod = await import('../connectors/netlify.mjs');
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
// Pagination — limit / per_page param
// ---------------------------------------------------------------------------
describe('netlify pagination defaults', () => {
  it('netlify_list_sites uses default limit of 20', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_sites').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=20'));
  });

  it('netlify_list_sites respects custom limit', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_sites').handler({ limit: 5 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=5'));
  });

  it('netlify_list_deploys uses default limit of 10', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_deploys').handler({ siteId: 's1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=10'));
  });

  it('netlify_list_submissions uses default limit of 20', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_submissions').handler({ formId: 'f1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=20'));
  });

  it('netlify_list_submissions respects custom limit', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_submissions').handler({ formId: 'f1', limit: 3 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=3'));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted from request
// ---------------------------------------------------------------------------
describe('netlify optional params omitted', () => {
  it('netlify_list_env_vars omits site_id when not provided', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_env_vars').handler({ accountId: 'team1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(!url.includes('site_id='));
  });

  it('netlify_list_env_vars includes site_id when provided', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_env_vars').handler({ accountId: 'team1', siteId: 's1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('site_id=s1'));
  });

  it('netlify_set_env_var defaults context to all', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    const result = await getTool('netlify_set_env_var').handler({ accountId: 'team1', key: 'K', value: 'V' });
    assert.equal(capturedBody[0].values[0].context, 'all');
    assert.ok(result.includes('all'));
  });

  it('netlify_set_env_var uses custom context when provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    const result = await getTool('netlify_set_env_var').handler({ accountId: 'team1', key: 'K', value: 'V', context: 'production' });
    assert.equal(capturedBody[0].values[0].context, 'production');
    assert.ok(result.includes('production'));
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('netlify error responses', () => {
  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({ message: 'Unauthorized' }),
    }));
    await assert.rejects(
      () => getTool('netlify_list_sites').handler({}),
      (err) => {
        assert.ok(err.message.includes('Netlify API 401'));
        return true;
      }
    );
  });

  it('throws on 404 not found', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ message: 'Not Found' }),
    }));
    await assert.rejects(
      () => getTool('netlify_get_site').handler({ siteId: 'ghost' }),
      (err) => {
        assert.ok(err.message.includes('Netlify API 404'));
        return true;
      }
    );
  });

  it('throws on 429 rate limited', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 429,
      text: async () => 'Too Many Requests',
      json: async () => ({ message: 'Rate limited' }),
    }));
    await assert.rejects(
      () => getTool('netlify_list_deploys').handler({ siteId: 's1' }),
      (err) => {
        assert.ok(err.message.includes('Netlify API 429'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ message: 'Server Error' }),
    }));
    await assert.rejects(
      () => getTool('netlify_trigger_build').handler({ siteId: 's1' }),
      (err) => {
        assert.ok(err.message.includes('Netlify API 500'));
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Empty result sets
// ---------------------------------------------------------------------------
describe('netlify empty results', () => {
  it('netlify_list_sites returns message on empty array', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_sites').handler({});
    assert.equal(result, 'No sites found.');
  });

  it('netlify_list_deploys returns message on empty array', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_deploys').handler({ siteId: 's1' });
    assert.equal(result, 'No deploys found.');
  });

  it('netlify_list_env_vars returns message on empty array', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_env_vars').handler({ accountId: 'team1' });
    assert.equal(result, 'No environment variables found.');
  });

  it('netlify_list_forms returns message on empty array', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_forms').handler({ siteId: 's1' });
    assert.equal(result, 'No forms found.');
  });

  it('netlify_list_submissions returns message on empty array', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_submissions').handler({ formId: 'f1' });
    assert.equal(result, 'No submissions found.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in input strings
// ---------------------------------------------------------------------------
describe('netlify special characters in inputs', () => {
  it('netlify_set_env_var passes special chars in value', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('netlify_set_env_var').handler({
      accountId: 'team1', key: 'MY_VAR', value: 'a=1&b=2 <tag> "quoted"',
    });
    assert.equal(capturedBody[0].values[0].value, 'a=1&b=2 <tag> "quoted"');
  });
});

// ---------------------------------------------------------------------------
// URL encoding of path parameters
// ---------------------------------------------------------------------------
describe('netlify URL encoding', () => {
  it('netlify_get_site encodes siteId in URL', async () => {
    mockFetch(200, {
      name: 'test', ssl_url: 'https://test.netlify.app', id: 's1',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });
    await getTool('netlify_get_site').handler({ siteId: 'my-site.netlify.app' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/sites/my-site.netlify.app'));
  });

  it('netlify_list_deploys encodes siteId in URL', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_deploys').handler({ siteId: 'site-with-dashes' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/sites/site-with-dashes/deploys'));
  });

  it('netlify_rollback encodes siteId in URL', async () => {
    mockFetch(200, { state: 'ready' });
    await getTool('netlify_rollback').handler({ siteId: 'my-site', deployId: 'd1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/sites/my-site/deploys/d1/restore'));
  });

  it('netlify_list_env_vars encodes accountId in URL', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_env_vars').handler({ accountId: 'my-team' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/accounts/my-team/env'));
  });

  it('netlify_trigger_build encodes siteId in URL', async () => {
    mockFetch(200, { id: 'b1', done: false });
    await getTool('netlify_trigger_build').handler({ siteId: 'my-site' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/sites/my-site/builds'));
  });

  it('netlify_list_forms encodes siteId in URL', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_forms').handler({ siteId: 'my-site' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/sites/my-site/forms'));
  });
});

// ---------------------------------------------------------------------------
// Complex input schemas
// ---------------------------------------------------------------------------
describe('netlify complex inputs', () => {
  it('netlify_set_env_var sends correct scopes array', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('netlify_set_env_var').handler({ accountId: 'team1', key: 'K', value: 'V' });
    assert.deepEqual(capturedBody[0].scopes, ['builds', 'functions', 'runtime', 'post_processing']);
  });

  it('netlify_get_deploy handles deploy with error_message', async () => {
    mockFetch(200, {
      id: 'd1', state: 'error', error_message: 'Build failed: exit code 1',
      created_at: '2026-01-01T00:00:00Z',
    });
    const result = await getTool('netlify_get_deploy').handler({ deployId: 'd1' });
    assert.ok(result.includes('error'));
    assert.ok(result.includes('Build failed'));
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
describe('netlify default values', () => {
  it('netlify_list_sites defaults limit to 20', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_sites').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=20'));
  });

  it('netlify_list_deploys defaults limit to 10', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_deploys').handler({ siteId: 's1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=10'));
  });

  it('netlify_set_env_var defaults context to all', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    await getTool('netlify_set_env_var').handler({ accountId: 'team1', key: 'X', value: 'Y' });
    assert.equal(capturedBody[0].values[0].context, 'all');
  });
});
