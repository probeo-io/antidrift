import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'cloudflare.json');
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

// ---------------------------------------------------------------------------
// cf_list_zones
// ---------------------------------------------------------------------------
describe('cf_list_zones handler', () => {
  it('returns formatted zone list', async () => {
    mockCfFetch(200, [
      { name: 'example.com', status: 'active', id: 'z1' },
      { name: 'test.dev', status: 'pending', id: 'z2' },
    ]);
    const result = await getTool('cf_list_zones').handler({});
    assert.ok(result.includes('example.com'));
    assert.ok(result.includes('active'));
    assert.ok(result.includes('[id: z1]'));
    assert.ok(result.includes('test.dev'));
    assert.ok(result.includes('pending'));
  });

  it('returns message when no zones', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_zones').handler({});
    assert.equal(result, 'No zones found.');
  });

  it('sends Bearer token header', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_zones').handler({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.headers['Authorization'], 'Bearer test-fake-token');
  });
});

// ---------------------------------------------------------------------------
// cf_list_dns_records
// ---------------------------------------------------------------------------
describe('cf_list_dns_records handler', () => {
  it('returns formatted DNS records', async () => {
    mockCfFetch(200, [
      { type: 'A', name: 'example.com', content: '1.2.3.4', proxied: true, ttl: 1, id: 'r1' },
      { type: 'CNAME', name: 'www.example.com', content: 'example.com', proxied: false, ttl: 3600, id: 'r2' },
    ]);
    const result = await getTool('cf_list_dns_records').handler({ zoneId: 'z1' });
    assert.ok(result.includes('example.com'));
    assert.ok(result.includes('1.2.3.4'));
    assert.ok(result.includes('[proxied]'));
    assert.ok(result.includes('CNAME'));
    assert.ok(result.includes('TTL: 3600'));
    assert.ok(result.includes('[id: r1]'));
  });

  it('returns message when no records', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_dns_records').handler({ zoneId: 'z1' });
    assert.equal(result, 'No DNS records found.');
  });

  it('calls correct API path with type filter', async () => {
    mockCfFetch(200, []);
    await getTool('cf_list_dns_records').handler({ zoneId: 'z1', type: 'MX' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/zones/z1/dns_records'));
    assert.ok(url.includes('type=MX'));
  });
});

// ---------------------------------------------------------------------------
// cf_list_pages_projects
// ---------------------------------------------------------------------------
describe('cf_list_pages_projects handler', () => {
  it('returns formatted project list', async () => {
    mockCfFetch(200, [
      { name: 'my-site', subdomain: 'my-site.pages.dev', source: { type: 'github' } },
    ]);
    const result = await getTool('cf_list_pages_projects').handler({ accountId: 'a1' });
    assert.ok(result.includes('my-site'));
    assert.ok(result.includes('my-site.pages.dev'));
    assert.ok(result.includes('[github]'));
  });

  it('returns message when no projects', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_pages_projects').handler({ accountId: 'a1' });
    assert.equal(result, 'No Pages projects found.');
  });
});

// ---------------------------------------------------------------------------
// cf_list_workers
// ---------------------------------------------------------------------------
describe('cf_list_workers handler', () => {
  it('returns formatted worker list', async () => {
    mockCfFetch(200, [
      { id: 'my-worker', modified_on: '2026-01-01T00:00:00Z' },
    ]);
    const result = await getTool('cf_list_workers').handler({ accountId: 'a1' });
    assert.ok(result.includes('my-worker'));
    assert.ok(result.includes('modified'));
  });

  it('returns message when no workers', async () => {
    mockCfFetch(200, []);
    const result = await getTool('cf_list_workers').handler({ accountId: 'a1' });
    assert.equal(result, 'No Workers found.');
  });
});

// ---------------------------------------------------------------------------
// cf_list_r2_buckets
// ---------------------------------------------------------------------------
describe('cf_list_r2_buckets handler', () => {
  it('returns formatted bucket list', async () => {
    mockCfFetch(200, {
      buckets: [
        { name: 'my-bucket', location: 'wnam', creation_date: '2026-01-01T00:00:00Z' },
      ]
    });
    const result = await getTool('cf_list_r2_buckets').handler({ accountId: 'a1' });
    assert.ok(result.includes('my-bucket'));
    assert.ok(result.includes('[wnam]'));
    assert.ok(result.includes('created'));
  });

  it('returns message when no buckets', async () => {
    mockCfFetch(200, { buckets: [] });
    const result = await getTool('cf_list_r2_buckets').handler({ accountId: 'a1' });
    assert.equal(result, 'No R2 buckets found.');
  });
});


// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('cloudflare error handling', () => {
  it('throws on 404 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ success: false }),
    }));
    await assert.rejects(
      () => getTool('cf_list_zones').handler({}),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 404'));
        return true;
      }
    );
  });

  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({ success: false }),
    }));
    await assert.rejects(
      () => getTool('cf_list_dns_records').handler({ zoneId: 'z1' }),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 401'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ success: false }),
    }));
    await assert.rejects(
      () => getTool('cf_list_workers').handler({ accountId: 'a1' }),
      (err) => {
        assert.ok(err.message.includes('Cloudflare API 500'));
        return true;
      }
    );
  });
});
