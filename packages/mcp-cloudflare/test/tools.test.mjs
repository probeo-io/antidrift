/**
 * Comprehensive unit tests for mcp-cloudflare tools and lib/client.mjs
 * Uses Node.js built-in test runner (node:test) with mocked ctx pattern.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '../lib/client.mjs';

// ─── Tool imports ────────────────────────────────────────────────────────────
import createDnsRecord from '../tools/create_dns_record.mjs';
import createR2Bucket from '../tools/create_r2_bucket.mjs';
import deleteDnsRecord from '../tools/delete_dns_record.mjs';
import deleteR2Bucket from '../tools/delete_r2_bucket.mjs';
import getPagesProject from '../tools/get_pages_project.mjs';
import getWorker from '../tools/get_worker.mjs';
import listDnsRecords from '../tools/list_dns_records.mjs';
import listPagesDeployments from '../tools/list_pages_deployments.mjs';
import listPagesProjects from '../tools/list_pages_projects.mjs';
import listR2Buckets from '../tools/list_r2_buckets.mjs';
import listWorkers from '../tools/list_workers.mjs';
import listZones from '../tools/list_zones.mjs';

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
    ctx: { credentials: { token: 'test-cf-token' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts }),
    getAllCalls: () => allCalls,
  };
}

function makeErrCtx(status) {
  const fetch = async () => ({
    ok: false,
    status,
    text: async () => `Error ${status}`,
    json: async () => ({ err: `Error ${status}` }),
  });
  return { ctx: { credentials: { token: 'test-cf-token' }, fetch } };
}

// ─── lib/client.mjs ──────────────────────────────────────────────────────────
describe('createClient (cloudflare)', () => {
  it('routes through provided fetchFn with correct URL prefix', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ success: true, result: [] }), text: async () => '{}' };
    };
    const { cf } = createClient({ token: 'tok-abc' }, mockFetch);
    await cf('GET', '/zones');
    assert.ok(captured.url.startsWith('https://api.cloudflare.com/client/v4'));
    assert.ok(captured.url.endsWith('/zones'));
  });

  it('sends Authorization: Bearer {token} header', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ success: true, result: [] }), text: async () => '{}' };
    };
    const { cf } = createClient({ token: 'my-cf-token' }, mockFetch);
    await cf('GET', '/zones');
    assert.equal(captured.opts.headers['Authorization'], 'Bearer my-cf-token');
  });

  it('sends Content-Type application/json', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ success: true, result: {} }), text: async () => '{}' };
    };
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await cf('POST', '/zones/z1/dns_records', { type: 'A', name: 'www', content: '1.2.3.4' });
    assert.equal(captured.opts.headers['Content-Type'], 'application/json');
  });

  it('serializes body as JSON string for POST', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ success: true, result: {} }), text: async () => '{}' };
    };
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await cf('POST', '/accounts/acc1/r2/buckets', { name: 'my-bucket' });
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.name, 'my-bucket');
  });

  it('does not include body for GET requests', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ success: true, result: [] }), text: async () => '{}' };
    };
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await cf('GET', '/zones');
    assert.equal(captured.opts.body, undefined);
  });

  it('throws with status code on non-ok response', async () => {
    const mockFetch = async () => ({
      ok: false, status: 403,
      text: async () => 'Forbidden',
      json: async () => ({}),
    });
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => cf('GET', '/zones'),
      (err) => { assert.ok(err.message.includes('403')); return true; }
    );
  });

  it('throws when success is false even with ok response', async () => {
    const mockFetch = async () => ({
      ok: true, status: 200,
      text: async () => '{}',
      json: async () => ({ success: false, errors: [{ message: 'Invalid token' }], result: null }),
    });
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => cf('GET', '/zones'),
      (err) => { assert.ok(err.message.includes('Invalid token')); return true; }
    );
  });

  it('throws with status 404 for not found', async () => {
    const mockFetch = async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({}),
    });
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => cf('GET', '/zones/no-such'),
      (err) => { assert.ok(err.message.includes('404')); return true; }
    );
  });

  it('error includes response body text', async () => {
    const mockFetch = async () => ({
      ok: false, status: 429,
      text: async () => 'Too many requests',
      json: async () => ({}),
    });
    const { cf } = createClient({ token: 'tok' }, mockFetch);
    await assert.rejects(
      () => cf('GET', '/zones'),
      (err) => { assert.ok(err.message.includes('Too many requests')); return true; }
    );
  });
});

// ─── Tool structure ───────────────────────────────────────────────────────────
const allTools = [
  { name: 'create_dns_record', tool: createDnsRecord },
  { name: 'create_r2_bucket', tool: createR2Bucket },
  { name: 'delete_dns_record', tool: deleteDnsRecord },
  { name: 'delete_r2_bucket', tool: deleteR2Bucket },
  { name: 'get_pages_project', tool: getPagesProject },
  { name: 'get_worker', tool: getWorker },
  { name: 'list_dns_records', tool: listDnsRecords },
  { name: 'list_pages_deployments', tool: listPagesDeployments },
  { name: 'list_pages_projects', tool: listPagesProjects },
  { name: 'list_r2_buckets', tool: listR2Buckets },
  { name: 'list_workers', tool: listWorkers },
  { name: 'list_zones', tool: listZones },
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

// ─── create_dns_record ────────────────────────────────────────────────────────
describe('create_dns_record', () => {
  it('POSTs to /zones/{zoneId}/dns_records with correct body', async () => {
    const data = { success: true, result: { id: 'rec1', type: 'A', name: 'www.example.com', content: '1.2.3.4' } };
    const { ctx, getCaptured } = makeCtx(data);
    await createDnsRecord.execute({ zoneId: 'z1', type: 'A', name: 'www', content: '1.2.3.4' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/zones/z1/dns_records'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.type, 'A');
    assert.equal(body.name, 'www');
    assert.equal(body.content, '1.2.3.4');
  });

  it('defaults proxied to false and ttl to 1', async () => {
    const data = { success: true, result: { id: 'rec2', type: 'CNAME', name: 'api', content: 'target.example.com' } };
    const { ctx, getCaptured } = makeCtx(data);
    await createDnsRecord.execute({ zoneId: 'z1', type: 'CNAME', name: 'api', content: 'target.example.com' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.proxied, false);
    assert.equal(body.ttl, 1);
  });

  it('accepts custom proxied and ttl values', async () => {
    const data = { success: true, result: { id: 'rec3', type: 'A', name: 'www', content: '5.6.7.8' } };
    const { ctx, getCaptured } = makeCtx(data);
    await createDnsRecord.execute({ zoneId: 'z1', type: 'A', name: 'www', content: '5.6.7.8', proxied: true, ttl: 300 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.proxied, true);
    assert.equal(body.ttl, 300);
  });

  it('returns formatted output with type, name, content, id', async () => {
    const data = { success: true, result: { id: 'rec4', type: 'TXT', name: 'example.com', content: 'v=spf1' } };
    const { ctx } = makeCtx(data);
    const result = await createDnsRecord.execute({ zoneId: 'z1', type: 'TXT', name: '@', content: 'v=spf1' }, ctx);
    assert.ok(result.includes('TXT'));
    assert.ok(result.includes('example.com'));
    assert.ok(result.includes('v=spf1'));
    assert.ok(result.includes('[id: rec4]'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(400);
    await assert.rejects(() => createDnsRecord.execute({ zoneId: 'z1', type: 'A', name: 'x', content: '1.2.3.4' }, ctx));
  });
});

// ─── create_r2_bucket ─────────────────────────────────────────────────────────
describe('create_r2_bucket', () => {
  it('POSTs to /accounts/{accountId}/r2/buckets', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: {} });
    await createR2Bucket.execute({ accountId: 'acc1', name: 'my-bucket' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/r2/buckets'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.name, 'my-bucket');
  });

  it('includes locationHint when location provided', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: {} });
    await createR2Bucket.execute({ accountId: 'acc1', name: 'eu-bucket', location: 'weur' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.locationHint, 'weur');
  });

  it('omits locationHint when not provided', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: {} });
    await createR2Bucket.execute({ accountId: 'acc1', name: 'no-loc' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.locationHint, undefined);
  });

  it('returns success message with bucket name', async () => {
    const { ctx } = makeCtx({ success: true, result: {} });
    const result = await createR2Bucket.execute({ accountId: 'acc1', name: 'my-assets' }, ctx);
    assert.ok(result.includes('my-assets'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(409);
    await assert.rejects(() => createR2Bucket.execute({ accountId: 'acc1', name: 'dupe' }, ctx));
  });
});

// ─── delete_dns_record ────────────────────────────────────────────────────────
describe('delete_dns_record', () => {
  it('DELETEs /zones/{zoneId}/dns_records/{recordId}', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: { id: 'rec1' } });
    await deleteDnsRecord.execute({ zoneId: 'z1', recordId: 'rec1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/zones/z1/dns_records/rec1'));
    assert.equal(opts.method, 'DELETE');
  });

  it('returns success message with record ID', async () => {
    const { ctx } = makeCtx({ success: true, result: {} });
    const result = await deleteDnsRecord.execute({ zoneId: 'z1', recordId: 'abc123' }, ctx);
    assert.ok(result.includes('abc123'));
  });

  it('does not include body', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: {} });
    await deleteDnsRecord.execute({ zoneId: 'z1', recordId: 'r1' }, ctx);
    const { opts } = getCaptured();
    assert.equal(opts.body, undefined);
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => deleteDnsRecord.execute({ zoneId: 'z1', recordId: 'no-rec' }, ctx));
  });
});

// ─── delete_r2_bucket ─────────────────────────────────────────────────────────
describe('delete_r2_bucket', () => {
  it('DELETEs /accounts/{accountId}/r2/buckets/{name}', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: {} });
    await deleteR2Bucket.execute({ accountId: 'acc1', name: 'old-bucket' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/r2/buckets/old-bucket'));
    assert.equal(opts.method, 'DELETE');
  });

  it('returns success message with bucket name', async () => {
    const { ctx } = makeCtx({ success: true, result: {} });
    const result = await deleteR2Bucket.execute({ accountId: 'acc1', name: 'bye-bucket' }, ctx);
    assert.ok(result.includes('bye-bucket'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(409);
    await assert.rejects(() => deleteR2Bucket.execute({ accountId: 'acc1', name: 'non-empty' }, ctx));
  });
});

// ─── get_pages_project ────────────────────────────────────────────────────────
describe('get_pages_project', () => {
  it('GETs /accounts/{accountId}/pages/projects/{projectName}', async () => {
    const data = {
      success: true,
      result: { name: 'my-site', subdomain: 'my-site.pages.dev', source: null, build_config: {}, latest_deployment: null, domains: [] },
    };
    const { ctx, getCaptured } = makeCtx(data);
    await getPagesProject.execute({ accountId: 'acc1', projectName: 'my-site' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/pages/projects/my-site'));
    assert.equal(opts.method, 'GET');
  });

  it('returns project name and subdomain', async () => {
    const data = {
      success: true,
      result: { name: 'my-site', subdomain: 'my-site.pages.dev', source: null, build_config: {}, latest_deployment: null, domains: [] },
    };
    const { ctx } = makeCtx(data);
    const result = await getPagesProject.execute({ accountId: 'acc1', projectName: 'my-site' }, ctx);
    assert.ok(result.includes('my-site'));
    assert.ok(result.includes('my-site.pages.dev'));
  });

  it('includes source, build config, and latest deployment when present', async () => {
    const data = {
      success: true,
      result: {
        name: 'blog',
        subdomain: 'blog.pages.dev',
        source: { type: 'github', config: { owner: 'myorg', repo_name: 'blog' } },
        build_config: { build_command: 'npm run build', destination_dir: 'dist' },
        latest_deployment: { url: 'https://abc.blog.pages.dev', latest_stage: { name: 'deploy' } },
        domains: ['blog.example.com'],
      },
    };
    const { ctx } = makeCtx(data);
    const result = await getPagesProject.execute({ accountId: 'acc1', projectName: 'blog' }, ctx);
    assert.ok(result.includes('github'));
    assert.ok(result.includes('myorg/blog'));
    assert.ok(result.includes('npm run build'));
    assert.ok(result.includes('dist'));
    assert.ok(result.includes('https://abc.blog.pages.dev'));
    assert.ok(result.includes('blog.example.com'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getPagesProject.execute({ accountId: 'acc1', projectName: 'no-project' }, ctx));
  });
});

// ─── get_worker ───────────────────────────────────────────────────────────────
describe('get_worker', () => {
  it('GETs /accounts/{accountId}/workers/scripts/{scriptName}/settings', async () => {
    const data = { success: true, result: { bindings: [], compatibility_date: '2024-01-01' } };
    const { ctx, getCaptured } = makeCtx(data);
    await getWorker.execute({ accountId: 'acc1', scriptName: 'my-worker' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/workers/scripts/my-worker/settings'));
  });

  it('returns script name', async () => {
    const data = { success: true, result: { bindings: [], compatibility_date: '2024-01-01' } };
    const { ctx } = makeCtx(data);
    const result = await getWorker.execute({ accountId: 'acc1', scriptName: 'edge-api' }, ctx);
    assert.ok(result.includes('edge-api'));
  });

  it('includes bindings when present', async () => {
    const data = {
      success: true,
      result: {
        bindings: [{ name: 'DB', type: 'kv_namespace' }, { name: 'BUCKET', type: 'r2_bucket' }],
        compatibility_date: '2024-06-01',
      },
    };
    const { ctx } = makeCtx(data);
    const result = await getWorker.execute({ accountId: 'acc1', scriptName: 'worker' }, ctx);
    assert.ok(result.includes('DB (kv_namespace)'));
    assert.ok(result.includes('BUCKET (r2_bucket)'));
  });

  it('includes compatibility_date when present', async () => {
    const data = { success: true, result: { bindings: [], compatibility_date: '2024-09-15' } };
    const { ctx } = makeCtx(data);
    const result = await getWorker.execute({ accountId: 'acc1', scriptName: 'w1' }, ctx);
    assert.ok(result.includes('2024-09-15'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => getWorker.execute({ accountId: 'acc1', scriptName: 'no-worker' }, ctx));
  });
});

// ─── list_dns_records ─────────────────────────────────────────────────────────
describe('list_dns_records', () => {
  it('GETs /zones/{zoneId}/dns_records with per_page limit', async () => {
    const data = { success: true, result: [] };
    const { ctx, getCaptured } = makeCtx(data);
    await listDnsRecords.execute({ zoneId: 'z1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/zones/z1/dns_records'));
    assert.ok(url.includes('per_page=50'));
    assert.equal(opts.method, 'GET');
  });

  it('appends type filter when provided', async () => {
    const data = { success: true, result: [] };
    const { ctx, getCaptured } = makeCtx(data);
    await listDnsRecords.execute({ zoneId: 'z1', type: 'MX' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('type=MX'));
  });

  it('returns formatted DNS records', async () => {
    const data = {
      success: true,
      result: [
        { id: 'r1', type: 'A', name: 'www.example.com', content: '1.2.3.4', proxied: false, ttl: 1 },
        { id: 'r2', type: 'CNAME', name: 'api.example.com', content: 'target.example.com', proxied: true, ttl: 1 },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listDnsRecords.execute({ zoneId: 'z1' }, ctx);
    assert.ok(result.includes('www.example.com'));
    assert.ok(result.includes('1.2.3.4'));
    assert.ok(result.includes('[id: r1]'));
    assert.ok(result.includes('[proxied]'));
  });

  it('shows TTL when not auto (not 1)', async () => {
    const data = {
      success: true,
      result: [{ id: 'r3', type: 'TXT', name: '_dmarc', content: 'v=DMARC1', proxied: false, ttl: 3600 }],
    };
    const { ctx } = makeCtx(data);
    const result = await listDnsRecords.execute({ zoneId: 'z1' }, ctx);
    assert.ok(result.includes('TTL: 3600'));
  });

  it('returns message when no DNS records found', async () => {
    const { ctx } = makeCtx({ success: true, result: [] });
    const result = await listDnsRecords.execute({ zoneId: 'z1' }, ctx);
    assert.equal(result, 'No DNS records found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => listDnsRecords.execute({ zoneId: 'z1' }, ctx));
  });
});

// ─── list_pages_deployments ───────────────────────────────────────────────────
describe('list_pages_deployments', () => {
  it('GETs /accounts/{accountId}/pages/projects/{projectName}/deployments', async () => {
    const data = { success: true, result: [] };
    const { ctx, getCaptured } = makeCtx(data);
    await listPagesDeployments.execute({ accountId: 'acc1', projectName: 'my-site' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/pages/projects/my-site/deployments'));
    assert.ok(url.includes('per_page=10'));
  });

  it('returns formatted deployment list', async () => {
    const data = {
      success: true,
      result: [
        {
          id: 'abc123456789',
          latest_stage: { name: 'deploy' },
          deployment_trigger: { metadata: { commit_message: 'Fix layout bug' } },
          created_on: new Date('2026-01-15').toISOString(),
          environment: 'production',
        },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listPagesDeployments.execute({ accountId: 'acc1', projectName: 'site' }, ctx);
    assert.ok(result.includes('abc12345'));
    assert.ok(result.includes('deploy'));
    assert.ok(result.includes('Fix layout bug'));
  });

  it('returns message when no deployments found', async () => {
    const { ctx } = makeCtx({ success: true, result: [] });
    const result = await listPagesDeployments.execute({ accountId: 'acc1', projectName: 'empty' }, ctx);
    assert.equal(result, 'No deployments found.');
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: [] });
    await listPagesDeployments.execute({ accountId: 'acc1', projectName: 'site', limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listPagesDeployments.execute({ accountId: 'acc1', projectName: 'gone' }, ctx));
  });
});

// ─── list_pages_projects ──────────────────────────────────────────────────────
describe('list_pages_projects', () => {
  it('GETs /accounts/{accountId}/pages/projects', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: [] });
    await listPagesProjects.execute({ accountId: 'acc1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/pages/projects'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted project list', async () => {
    const data = {
      success: true,
      result: [
        { name: 'blog', subdomain: 'blog.pages.dev', source: { type: 'github' } },
        { name: 'docs', subdomain: 'docs.pages.dev', source: null },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listPagesProjects.execute({ accountId: 'acc1' }, ctx);
    assert.ok(result.includes('blog'));
    assert.ok(result.includes('blog.pages.dev'));
    assert.ok(result.includes('[github]'));
    assert.ok(result.includes('docs'));
  });

  it('returns message when no projects found', async () => {
    const { ctx } = makeCtx({ success: true, result: [] });
    const result = await listPagesProjects.execute({ accountId: 'acc1' }, ctx);
    assert.equal(result, 'No Pages projects found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401);
    await assert.rejects(() => listPagesProjects.execute({ accountId: 'acc1' }, ctx));
  });
});

// ─── list_r2_buckets ──────────────────────────────────────────────────────────
describe('list_r2_buckets', () => {
  it('GETs /accounts/{accountId}/r2/buckets', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: { buckets: [] } });
    await listR2Buckets.execute({ accountId: 'acc1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/r2/buckets'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted bucket list', async () => {
    const data = {
      success: true,
      result: {
        buckets: [
          { name: 'assets', location: 'wnam', creation_date: new Date('2025-01-01').toISOString() },
          { name: 'backups', location: null, creation_date: new Date('2025-06-01').toISOString() },
        ],
      },
    };
    const { ctx } = makeCtx(data);
    const result = await listR2Buckets.execute({ accountId: 'acc1' }, ctx);
    assert.ok(result.includes('assets'));
    assert.ok(result.includes('[wnam]'));
    assert.ok(result.includes('backups'));
  });

  it('returns message when no buckets found', async () => {
    const { ctx } = makeCtx({ success: true, result: { buckets: [] } });
    const result = await listR2Buckets.execute({ accountId: 'acc1' }, ctx);
    assert.equal(result, 'No R2 buckets found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => listR2Buckets.execute({ accountId: 'acc1' }, ctx));
  });
});

// ─── list_workers ─────────────────────────────────────────────────────────────
describe('list_workers', () => {
  it('GETs /accounts/{accountId}/workers/scripts', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: [] });
    await listWorkers.execute({ accountId: 'acc1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/accounts/acc1/workers/scripts'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted worker list with IDs and modified dates', async () => {
    const data = {
      success: true,
      result: [
        { id: 'api-worker', modified_on: new Date('2026-03-01').toISOString() },
        { id: 'auth-worker', modified_on: new Date('2026-01-15').toISOString() },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listWorkers.execute({ accountId: 'acc1' }, ctx);
    assert.ok(result.includes('api-worker'));
    assert.ok(result.includes('auth-worker'));
    assert.ok(result.includes('modified:'));
  });

  it('returns message when no workers found', async () => {
    const { ctx } = makeCtx({ success: true, result: [] });
    const result = await listWorkers.execute({ accountId: 'acc1' }, ctx);
    assert.equal(result, 'No Workers found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401);
    await assert.rejects(() => listWorkers.execute({ accountId: 'acc1' }, ctx));
  });
});

// ─── list_zones ───────────────────────────────────────────────────────────────
describe('list_zones', () => {
  it('GETs /zones with per_page', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: [] });
    await listZones.execute({}, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/zones'));
    assert.ok(url.includes('per_page=20'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted zone list with status and ID', async () => {
    const data = {
      success: true,
      result: [
        { id: 'z1', name: 'example.com', status: 'active' },
        { id: 'z2', name: 'other.io', status: 'pending' },
      ],
    };
    const { ctx } = makeCtx(data);
    const result = await listZones.execute({}, ctx);
    assert.ok(result.includes('example.com'));
    assert.ok(result.includes('[active]'));
    assert.ok(result.includes('[id: z1]'));
    assert.ok(result.includes('other.io'));
  });

  it('respects custom limit', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: [] });
    await listZones.execute({ limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('per_page=5'));
  });

  it('returns message when no zones found', async () => {
    const { ctx } = makeCtx({ success: true, result: [] });
    const result = await listZones.execute({}, ctx);
    assert.equal(result, 'No zones found.');
  });

  it('sends correct Authorization header', async () => {
    const { ctx, getCaptured } = makeCtx({ success: true, result: [] });
    await listZones.execute({}, ctx);
    const { opts } = getCaptured();
    assert.equal(opts.headers['Authorization'], 'Bearer test-cf-token');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => listZones.execute({}, ctx));
  });
});
