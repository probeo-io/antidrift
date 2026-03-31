import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'cloudflare.json');
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

  const mod = await import('../connectors/cloudflare.mjs');
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

function mockCfFetch(status, result) {
  mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, result }),
    text: async () => JSON.stringify({ success: true, result }),
  }));
}

function mockCfError(status, body) {
  mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? { success: false } : body),
  }));
}

// ---------------------------------------------------------------------------
// Pagination — limit param
// ---------------------------------------------------------------------------
describe('cloudflare pagination defaults', () => {
  it('cf_list_zones uses default limit of 20', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_zones').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=20'));
  });

  it('cf_list_zones respects custom limit', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_zones').handler({ limit: 5 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=5'));
  });

  it('cf_list_dns_records uses default limit of 50', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_dns_records').handler({ zoneId: 'z1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=50'));
  });

  it('cf_list_dns_records respects custom limit', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_dns_records').handler({ zoneId: 'z1', limit: 10 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=10'));
  });

  it('cf_list_pages_deployments uses default limit of 10', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_pages_deployments').handler({ accountId: 'a1', projectName: 'proj' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('per_page=10'));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted from request
// ---------------------------------------------------------------------------
describe('cloudflare optional params omitted', () => {
  it('cf_list_dns_records omits type filter when not provided', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_dns_records').handler({ zoneId: 'z1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(!url.includes('type='));
  });

  it('cf_create_dns_record uses default proxied=false and ttl=1', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: { type: 'A', name: 'test.example.com', content: '1.2.3.4', id: 'r1' } }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_dns_record').handler({ zoneId: 'z1', type: 'A', name: 'test', content: '1.2.3.4' });
    assert.equal(capturedBody.proxied, false);
    assert.equal(capturedBody.ttl, 1);
  });

  it('cf_create_r2_bucket omits locationHint when location not provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: {} }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_r2_bucket').handler({ accountId: 'a1', name: 'bucket' });
    assert.equal(capturedBody.name, 'bucket');
    assert.equal(capturedBody.locationHint, undefined);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('cloudflare error responses', () => {
  it('throws on 401 unauthorized', async () => {
    mockCfError(401, 'Unauthorized');
    await assert.rejects(
      () => getTool('cf_list_zones').handler({}),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 401'));
        return true;
      }
    );
  });

  it('throws on 404 not found', async () => {
    mockCfError(404, 'Not Found');
    await assert.rejects(
      () => getTool('cf_get_pages_project').handler({ accountId: 'a1', projectName: 'ghost' }),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 404'));
        return true;
      }
    );
  });

  it('throws on 429 rate limited', async () => {
    mockCfError(429, 'Too Many Requests');
    await assert.rejects(
      () => getTool('cf_list_zones').handler({}),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 429'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mockCfError(500, 'Internal Server Error');
    await assert.rejects(
      () => getTool('cf_list_workers').handler({ accountId: 'a1' }),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 500'));
        return true;
      }
    );
  });

  it('throws on success=false with error message', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      json: async () => ({ success: false, errors: [{ message: 'Invalid zone' }] }),
      text: async () => JSON.stringify({ success: false }),
    }));
    await assert.rejects(
      () => getTool('cf_list_zones').handler({}),
      (err) => {
        assert.ok(err.message.includes('Invalid zone'));
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Empty result sets
// ---------------------------------------------------------------------------
describe('cloudflare empty results', () => {
  it('cf_list_zones returns message on empty array', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_zones').handler({});
    assert.equal(result, 'No zones found.');
  });

  it('cf_list_dns_records returns message on empty array', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_dns_records').handler({ zoneId: 'z1' });
    assert.equal(result, 'No DNS records found.');
  });

  it('cf_list_pages_projects returns message on empty array', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_pages_projects').handler({ accountId: 'a1' });
    assert.equal(result, 'No Pages projects found.');
  });

  it('cf_list_pages_deployments returns message on empty array', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_pages_deployments').handler({ accountId: 'a1', projectName: 'proj' });
    assert.equal(result, 'No deployments found.');
  });

  it('cf_list_workers returns message on empty array', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_workers').handler({ accountId: 'a1' });
    assert.equal(result, 'No Workers found.');
  });

  it('cf_list_r2_buckets returns message on empty buckets', async () => {
    mockCfFetch(200, { buckets: [] });
    const result = await getTool('cf_list_r2_buckets').handler({ accountId: 'a1' });
    assert.equal(result, 'No R2 buckets found.');
  });

  it('cf_list_zones returns message on null result', async () => {
    mockCfFetch(200, null);
    const result = await getTool('cf_list_zones').handler({});
    assert.equal(result, 'No zones found.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in input strings
// ---------------------------------------------------------------------------
describe('cloudflare special characters in inputs', () => {
  it('cf_create_dns_record handles special chars in content', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: { type: 'TXT', name: '_dmarc.example.com', content: 'v=DMARC1; p=none; rua=mailto:d@example.com', id: 'r1' } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('cf_create_dns_record').handler({
      zoneId: 'z1', type: 'TXT', name: '_dmarc', content: 'v=DMARC1; p=none; rua=mailto:d@example.com'
    });
    assert.equal(capturedBody.content, 'v=DMARC1; p=none; rua=mailto:d@example.com');
    assert.ok(result.includes('Created'));
  });

  it('cf_create_dns_record handles ampersands and angle brackets in TXT record', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: { type: 'TXT', name: 'test.example.com', content: 'key=a&b <c> "d"', id: 'r2' } }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_dns_record').handler({
      zoneId: 'z1', type: 'TXT', name: 'test', content: 'key=a&b <c> "d"'
    });
    assert.equal(capturedBody.content, 'key=a&b <c> "d"');
  });
});

// ---------------------------------------------------------------------------
// URL encoding of path parameters
// ---------------------------------------------------------------------------
describe('cloudflare URL encoding', () => {
  it('cf_list_dns_records includes zoneId in URL path', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_dns_records').handler({ zoneId: 'abc-123-def' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/zones/abc-123-def/dns_records'));
  });

  it('cf_delete_dns_record includes both zoneId and recordId in path', async () => {
    mockCfFetch(200, { id: 'r1' });
    await getTool('cf_delete_dns_record').handler({ zoneId: 'z-1', recordId: 'r-1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/zones/z-1/dns_records/r-1'));
  });

  it('cf_get_worker includes scriptName in URL path', async () => {
    mockCfFetch(200, { bindings: [], compatibility_date: '2026-01-01' });
    await getTool('cf_get_worker').handler({ accountId: 'a1', scriptName: 'my-worker-script' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/workers/scripts/my-worker-script/settings'));
  });

  it('cf_get_pages_project includes projectName in URL path', async () => {
    mockCfFetch(200, {
      name: 'my-project', subdomain: 'my-project.pages.dev',
    });
    await getTool('cf_get_pages_project').handler({ accountId: 'a1', projectName: 'my-project' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/pages/projects/my-project'));
  });

  it('cf_delete_r2_bucket includes bucket name in URL path', async () => {
    mockCfFetch(200, {});
    await getTool('cf_delete_r2_bucket').handler({ accountId: 'a1', name: 'my-bucket' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/r2/buckets/my-bucket'));
  });
});

// ---------------------------------------------------------------------------
// Complex input schemas
// ---------------------------------------------------------------------------
describe('cloudflare complex inputs', () => {
  it('cf_create_dns_record sends full body with all optional params', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: { type: 'A', name: 'sub.example.com', content: '10.0.0.1', id: 'r5' } }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_dns_record').handler({
      zoneId: 'z1', type: 'A', name: 'sub', content: '10.0.0.1', proxied: true, ttl: 300,
    });
    assert.equal(capturedBody.type, 'A');
    assert.equal(capturedBody.name, 'sub');
    assert.equal(capturedBody.content, '10.0.0.1');
    assert.equal(capturedBody.proxied, true);
    assert.equal(capturedBody.ttl, 300);
  });

  it('cf_create_r2_bucket sends locationHint when location provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: {} }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_r2_bucket').handler({ accountId: 'a1', name: 'eu-bucket', location: 'weur' });
    assert.equal(capturedBody.name, 'eu-bucket');
    assert.equal(capturedBody.locationHint, 'weur');
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
describe('cloudflare default values', () => {
  it('cf_create_dns_record defaults proxied to false', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: { type: 'A', name: 'x.example.com', content: '1.1.1.1', id: 'r9' } }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_dns_record').handler({ zoneId: 'z1', type: 'A', name: 'x', content: '1.1.1.1' });
    assert.equal(capturedBody.proxied, false);
  });

  it('cf_create_dns_record defaults ttl to 1 (auto)', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ success: true, result: { type: 'A', name: 'y.example.com', content: '2.2.2.2', id: 'r10' } }),
        text: async () => '{}',
      };
    });
    await getTool('cf_create_dns_record').handler({ zoneId: 'z1', type: 'A', name: 'y', content: '2.2.2.2' });
    assert.equal(capturedBody.ttl, 1);
  });
});
