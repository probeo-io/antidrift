/**
 * Comprehensive unit tests for mcp-pipedrive tools
 * Tests all tools/*.mjs files and lib/client.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const TEST_CREDS = { domain: 'myorg', apiToken: 'test-api-token' };

function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200, responses = null } = opts;
  const calls = [];

  const fetch = async (url, reqOpts) => {
    calls.push({ url, opts: reqOpts });
    let data = responseData;
    if (responses && calls.length <= responses.length) {
      data = responses[calls.length - 1];
    }
    return {
      ok,
      status,
      text: async () => JSON.stringify(data),
      json: async () => data,
    };
  };

  return {
    ctx: { credentials: TEST_CREDS, fetch },
    getCalls: () => calls,
    getCall: (i = 0) => calls[i],
  };
}

function makeErrCtx(status = 400, message = 'Bad Request') {
  return makeCtx({ message }, { ok: false, status });
}

// ---------------------------------------------------------------------------
// lib/client.mjs
// ---------------------------------------------------------------------------

describe('lib/client.mjs — createClient', async () => {
  const { createClient, formatDeal, formatPerson, formatOrg } = await import('../lib/client.mjs');

  it('includes api_token as query param', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await pd('GET', '/deals');
    assert.ok(getCall().url.includes('api_token=test-api-token'));
  });

  it('builds URL from domain + path', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await pd('GET', '/deals');
    assert.ok(getCall().url.startsWith('https://myorg.pipedrive.com/api/v1/deals'));
  });

  it('sends Content-Type application/json', async () => {
    const { ctx, getCall } = makeCtx({ data: {} });
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await pd('GET', '/deals');
    assert.equal(getCall().opts.headers['Content-Type'], 'application/json');
  });

  it('serializes body as JSON for POST', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 1, title: 'Deal' } });
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await pd('POST', '/deals', { title: 'New Deal', value: 1000 });
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.title, 'New Deal');
    assert.equal(body.value, 1000);
  });

  it('omits body for GET', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await pd('GET', '/persons');
    assert.equal(getCall().opts.body, undefined);
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401, 'Unauthorized');
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => pd('GET', '/deals'), /Pipedrive API 401/);
  });

  it('throws on 404', async () => {
    const { ctx } = makeErrCtx(404);
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => pd('GET', '/deals/9999'), /Pipedrive API 404/);
  });

  it('throws on 500 error', async () => {
    const { ctx } = makeErrCtx(500);
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => pd('GET', '/deals'), /500/);
  });

  it('formatDeal — title, stage, value, person, status, id', () => {
    const line = formatDeal({ id: 1, title: 'BigDeal', stage_id: 3, value: 9000, currency: 'USD', person_name: 'Alice', status: 'open' });
    assert.ok(line.includes('BigDeal'));
    assert.ok(line.includes('stage: 3'));
    assert.ok(line.includes('9000'));
    assert.ok(line.includes('Alice'));
    assert.ok(line.includes('open'));
    assert.ok(line.includes('[id: 1]'));
  });

  it('formatDeal — minimal (just title and id)', () => {
    const line = formatDeal({ id: 2, title: 'SmallDeal' });
    assert.ok(line.includes('SmallDeal'));
    assert.ok(line.includes('[id: 2]'));
  });

  it('formatPerson — name, email, phone, org, id', () => {
    const line = formatPerson({
      id: 5, name: 'Bob',
      email: [{ value: 'bob@ex.com' }],
      phone: [{ value: '555-1234' }],
      org_name: 'WidgetCo'
    });
    assert.ok(line.includes('Bob'));
    assert.ok(line.includes('bob@ex.com'));
    assert.ok(line.includes('555-1234'));
    assert.ok(line.includes('WidgetCo'));
    assert.ok(line.includes('[id: 5]'));
  });

  it('formatPerson — minimal (no email/phone/org)', () => {
    const line = formatPerson({ id: 6, name: 'Anon', email: [], phone: [] });
    assert.ok(line.includes('Anon'));
    assert.ok(line.includes('[id: 6]'));
  });

  it('formatOrg — name, address, id', () => {
    const line = formatOrg({ id: 10, name: 'Corp', address: '123 Main St' });
    assert.ok(line.includes('Corp'));
    assert.ok(line.includes('123 Main St'));
    assert.ok(line.includes('[id: 10]'));
  });

  it('formatOrg — without address', () => {
    const line = formatOrg({ id: 11, name: 'Minimal Corp' });
    assert.ok(line.includes('Minimal Corp'));
    assert.ok(line.includes('[id: 11]'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_deals.mjs
// ---------------------------------------------------------------------------

describe('tools/list_deals.mjs', async () => {
  const tool = (await import('../tools/list_deals.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 0);
    assert.equal(typeof tool.input, 'object');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /deals with status and limit', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({ status: 'open', limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/deals'));
    assert.ok(getCall().url.includes('status=open'));
    assert.ok(getCall().url.includes('limit=10'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns "No deals found." when empty', async () => {
    const { ctx } = makeCtx({ data: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No deals found.');
  });

  it('returns formatted deal lines', async () => {
    const { ctx } = makeCtx({
      data: [
        { id: 1, title: 'Deal A', stage_id: 1, value: 5000, currency: 'USD', person_name: 'Alice', status: 'open' },
        { id: 2, title: 'Deal B', status: 'won' },
      ]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Deal A'));
    assert.ok(out.includes('5000'));
    assert.ok(out.includes('Deal B'));
    assert.ok(out.includes('[id: 1]'));
  });

  it('defaults status to open, limit to 20', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('status=open'));
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_deal.mjs
// ---------------------------------------------------------------------------

describe('tools/get_deal.mjs', async () => {
  const tool = (await import('../tools/get_deal.mjs')).default;

  it('GETs /deals/:id', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 5, title: 'X', status: 'open', add_time: '2024-01-01' } });
    await tool.execute({ id: 5 }, ctx);
    assert.ok(getCall().url.includes('/deals/5'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns deal details', async () => {
    const { ctx } = makeCtx({
      data: {
        id: 5, title: 'Enterprise Deal', status: 'open',
        value: 100000, currency: 'USD', person_name: 'Bob',
        org_name: 'BigCorp', pipeline_id: 2, stage_id: 4,
        expected_close_date: '2025-12-31', owner_name: 'Sales Rep',
        add_time: '2024-06-01T00:00:00Z'
      }
    });
    const out = await tool.execute({ id: 5 }, ctx);
    assert.ok(out.includes('Enterprise Deal'));
    assert.ok(out.includes('open'));
    assert.ok(out.includes('100000'));
    assert.ok(out.includes('Bob'));
    assert.ok(out.includes('BigCorp'));
    assert.ok(out.includes('2025-12-31'));
    assert.ok(out.includes('Sales Rep'));
    assert.ok(out.includes('[id: 5]'));
  });

  it('handles missing optional fields', async () => {
    const { ctx } = makeCtx({ data: { id: 6, title: 'Minimal', status: 'lost', add_time: '2024-01-01' } });
    const out = await tool.execute({ id: 6 }, ctx);
    assert.ok(out.includes('Minimal'));
    assert.ok(out.includes('[id: 6]'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ id: 9999 }, ctx), /Pipedrive API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/create_deal.mjs
// ---------------------------------------------------------------------------

describe('tools/create_deal.mjs', async () => {
  const tool = (await import('../tools/create_deal.mjs')).default;

  it('POSTs to /deals', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 100, title: 'New Deal' } });
    await tool.execute({ title: 'New Deal' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/deals'));
  });

  it('sends title in body', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 100, title: 'New Deal' } });
    await tool.execute({ title: 'New Deal' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.title, 'New Deal');
  });

  it('includes optional value, currency, personId, orgId', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 101, title: 'Full Deal' } });
    await tool.execute({ title: 'Full Deal', value: 50000, currency: 'EUR', personId: 7, orgId: 3 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.value, 50000);
    assert.equal(body.currency, 'EUR');
    assert.equal(body.person_id, 7);
    assert.equal(body.org_id, 3);
  });

  it('does not include undefined optional fields', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 102, title: 'Min' } });
    await tool.execute({ title: 'Min' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.value, undefined);
    assert.equal(body.person_id, undefined);
  });

  it('returns success message with title and id', async () => {
    const { ctx } = makeCtx({ data: { id: 103, title: 'Success Deal' } });
    const out = await tool.execute({ title: 'Success Deal' }, ctx);
    assert.ok(out.includes('Success Deal'));
    assert.ok(out.includes('103'));
  });
});

// ---------------------------------------------------------------------------
// tools/update_deal.mjs
// ---------------------------------------------------------------------------

describe('tools/update_deal.mjs', async () => {
  const tool = (await import('../tools/update_deal.mjs')).default;

  it('PUTs to /deals/:id', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 50, title: 'Updated' } });
    await tool.execute({ id: 50, title: 'Updated' }, ctx);
    assert.equal(getCall().opts.method, 'PUT');
    assert.ok(getCall().url.includes('/deals/50'));
  });

  it('sends changed fields in body', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 50, title: 'Updated Title' } });
    await tool.execute({ id: 50, title: 'Updated Title', value: 75000, status: 'won', stageId: 5 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.title, 'Updated Title');
    assert.equal(body.value, 75000);
    assert.equal(body.status, 'won');
    assert.equal(body.stage_id, 5);
  });

  it('sends empty body when only id provided', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 51, title: 'No Change' } });
    await tool.execute({ id: 51 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.deepEqual(body, {});
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({ data: { id: 52, title: 'Done' } });
    const out = await tool.execute({ id: 52, status: 'won' }, ctx);
    assert.ok(out.includes('Done'));
    assert.ok(out.includes('52'));
  });
});

// ---------------------------------------------------------------------------
// tools/search_deals.mjs
// ---------------------------------------------------------------------------

describe('tools/search_deals.mjs', async () => {
  const tool = (await import('../tools/search_deals.mjs')).default;

  it('GETs /deals/search with encoded term', async () => {
    const { ctx, getCall } = makeCtx({ data: { items: [] } });
    await tool.execute({ query: 'enterprise deal', limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/deals/search'));
    // new URL() normalizes %20 to + in query params
    assert.ok(getCall().url.includes('term=enterprise') && getCall().url.includes('deal'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns no-match message when empty', async () => {
    const { ctx } = makeCtx({ data: { items: [] } });
    const out = await tool.execute({ query: 'nothing' }, ctx);
    assert.ok(out.includes('nothing'));
    assert.ok(out.includes('No deals matching'));
  });

  it('returns formatted deal lines', async () => {
    const { ctx } = makeCtx({
      data: {
        items: [
          { item: { id: 10, title: 'Found Deal', status: 'open' } },
          { item: { id: 11, title: 'Another Deal', status: 'won' } },
        ]
      }
    });
    const out = await tool.execute({ query: 'deal' }, ctx);
    assert.ok(out.includes('Found Deal'));
    assert.ok(out.includes('Another Deal'));
    assert.ok(out.includes('[id: 10]'));
  });

  it('default limit is 20', async () => {
    const { ctx, getCall } = makeCtx({ data: { items: [] } });
    await tool.execute({ query: 'test' }, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_persons.mjs
// ---------------------------------------------------------------------------

describe('tools/list_persons.mjs', async () => {
  const tool = (await import('../tools/list_persons.mjs')).default;

  it('GETs /persons with limit', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/persons'));
    assert.ok(getCall().url.includes('limit=5'));
  });

  it('returns "No contacts found." when empty', async () => {
    const { ctx } = makeCtx({ data: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No contacts found.');
  });

  it('returns formatted person lines', async () => {
    const { ctx } = makeCtx({
      data: [
        { id: 1, name: 'Alice', email: [{ value: 'alice@ex.com' }], phone: [], org_name: 'Alpha' },
        { id: 2, name: 'Bob', email: [], phone: [{ value: '555' }], org_name: null },
      ]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('alice@ex.com'));
    assert.ok(out.includes('Alpha'));
    assert.ok(out.includes('Bob'));
    assert.ok(out.includes('555'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_person.mjs
// ---------------------------------------------------------------------------

describe('tools/get_person.mjs', async () => {
  const tool = (await import('../tools/get_person.mjs')).default;

  it('GETs /persons/:id', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 3, name: 'X', email: [], phone: [], open_deals_count: 0 } });
    await tool.execute({ id: 3 }, ctx);
    assert.ok(getCall().url.includes('/persons/3'));
  });

  it('returns person details', async () => {
    const { ctx } = makeCtx({
      data: {
        id: 4, name: 'Carol',
        email: [{ value: 'carol@ex.com' }, { value: 'carol2@ex.com' }],
        phone: [{ value: '555-9876' }],
        org_name: 'CarolCo', owner_name: 'Manager',
        open_deals_count: 3
      }
    });
    const out = await tool.execute({ id: 4 }, ctx);
    assert.ok(out.includes('Carol'));
    assert.ok(out.includes('carol@ex.com'));
    assert.ok(out.includes('carol2@ex.com'));
    assert.ok(out.includes('555-9876'));
    assert.ok(out.includes('CarolCo'));
    assert.ok(out.includes('Manager'));
    assert.ok(out.includes('3'));
    assert.ok(out.includes('[id: 4]'));
  });

  it('handles missing optional fields', async () => {
    const { ctx } = makeCtx({ data: { id: 7, name: 'Min', email: [], phone: [], open_deals_count: 0 } });
    const out = await tool.execute({ id: 7 }, ctx);
    assert.ok(out.includes('Min'));
    assert.ok(out.includes('[id: 7]'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ id: 9999 }, ctx), /Pipedrive API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/create_person.mjs
// ---------------------------------------------------------------------------

describe('tools/create_person.mjs', async () => {
  const tool = (await import('../tools/create_person.mjs')).default;

  it('POSTs to /persons', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 20, name: 'New Person' } });
    await tool.execute({ name: 'New Person' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/persons'));
  });

  it('sends name in body', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 20, name: 'New Person' } });
    await tool.execute({ name: 'New Person' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.name, 'New Person');
  });

  it('formats email as array with primary flag', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 21, name: 'Email Person' } });
    await tool.execute({ name: 'Email Person', email: 'test@ex.com' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.deepEqual(body.email, [{ value: 'test@ex.com', primary: true }]);
  });

  it('formats phone as array with primary flag', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 22, name: 'Phone Person' } });
    await tool.execute({ name: 'Phone Person', phone: '555-1111' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.deepEqual(body.phone, [{ value: '555-1111', primary: true }]);
  });

  it('includes org_id when provided', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 23, name: 'Org Person' } });
    await tool.execute({ name: 'Org Person', orgId: 99 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.org_id, 99);
  });

  it('returns success message with name and id', async () => {
    const { ctx } = makeCtx({ data: { id: 24, name: 'Created' } });
    const out = await tool.execute({ name: 'Created' }, ctx);
    assert.ok(out.includes('Created'));
    assert.ok(out.includes('24'));
  });
});

// ---------------------------------------------------------------------------
// tools/search_persons.mjs
// ---------------------------------------------------------------------------

describe('tools/search_persons.mjs', async () => {
  const tool = (await import('../tools/search_persons.mjs')).default;

  it('GETs /persons/search with encoded term', async () => {
    const { ctx, getCall } = makeCtx({ data: { items: [] } });
    await tool.execute({ query: 'john doe' }, ctx);
    assert.ok(getCall().url.includes('/persons/search'));
    // new URL() normalizes %20 to + in query params
    assert.ok(getCall().url.includes('term=john') && getCall().url.includes('doe'));
  });

  it('returns no-match message when empty', async () => {
    const { ctx } = makeCtx({ data: { items: [] } });
    const out = await tool.execute({ query: 'nobody' }, ctx);
    assert.ok(out.includes('nobody'));
    assert.ok(out.includes('No contacts matching'));
  });

  it('returns formatted person lines', async () => {
    const { ctx } = makeCtx({
      data: {
        items: [
          { item: { id: 30, name: 'John', email: [{ value: 'j@ex.com' }], phone: [], org_name: 'Co' } },
        ]
      }
    });
    const out = await tool.execute({ query: 'john' }, ctx);
    assert.ok(out.includes('John'));
    assert.ok(out.includes('j@ex.com'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_organizations.mjs
// ---------------------------------------------------------------------------

describe('tools/list_organizations.mjs', async () => {
  const tool = (await import('../tools/list_organizations.mjs')).default;

  it('GETs /organizations with limit', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/organizations'));
    assert.ok(getCall().url.includes('limit=5'));
  });

  it('returns "No organizations found." when empty', async () => {
    const { ctx } = makeCtx({ data: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No organizations found.');
  });

  it('returns formatted org lines', async () => {
    const { ctx } = makeCtx({
      data: [
        { id: 1, name: 'Acme', address: '1 Main St' },
        { id: 2, name: 'Globex', address: null },
      ]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Acme'));
    assert.ok(out.includes('1 Main St'));
    assert.ok(out.includes('Globex'));
    assert.ok(out.includes('[id: 1]'));
  });
});

// ---------------------------------------------------------------------------
// tools/create_organization.mjs
// ---------------------------------------------------------------------------

describe('tools/create_organization.mjs', async () => {
  const tool = (await import('../tools/create_organization.mjs')).default;

  it('POSTs to /organizations', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 40, name: 'NewOrg' } });
    await tool.execute({ name: 'NewOrg' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/organizations'));
  });

  it('sends name in body', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 40, name: 'NewOrg' } });
    await tool.execute({ name: 'NewOrg' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.name, 'NewOrg');
  });

  it('includes address when provided', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 41, name: 'HQ' } });
    await tool.execute({ name: 'HQ', address: '100 Oak Ave' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.address, '100 Oak Ave');
  });

  it('does not include address when omitted', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 42, name: 'NoAddr' } });
    await tool.execute({ name: 'NoAddr' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.address, undefined);
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({ data: { id: 43, name: 'ResultOrg' } });
    const out = await tool.execute({ name: 'ResultOrg' }, ctx);
    assert.ok(out.includes('ResultOrg'));
    assert.ok(out.includes('43'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_activities.mjs
// ---------------------------------------------------------------------------

describe('tools/list_activities.mjs', async () => {
  const tool = (await import('../tools/list_activities.mjs')).default;

  it('GETs /activities with limit', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/activities'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('includes type filter when provided', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({ type: 'call' }, ctx);
    assert.ok(getCall().url.includes('type=call'));
  });

  it('includes done filter when provided', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({ done: 1 }, ctx);
    assert.ok(getCall().url.includes('done=1'));
  });

  it('omits done param when undefined', async () => {
    const { ctx, getCall } = makeCtx({ data: [] });
    await tool.execute({}, ctx);
    assert.ok(!getCall().url.includes('done='));
  });

  it('returns "No activities found." when empty', async () => {
    const { ctx } = makeCtx({ data: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No activities found.');
  });

  it('returns formatted activity lines', async () => {
    const { ctx } = makeCtx({
      data: [
        { id: 1, type: 'call', subject: 'Follow-up', done: 0, due_date: '2025-06-01', person_name: 'Alice' },
        { id: 2, type: 'meeting', subject: 'Demo', done: 1, due_date: null, person_name: null },
      ]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('call'));
    assert.ok(out.includes('Follow-up'));
    assert.ok(out.includes('2025-06-01'));
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('meeting'));
    assert.ok(out.includes('Demo'));
    assert.ok(out.includes('[id: 1]'));
  });
});

// ---------------------------------------------------------------------------
// tools/create_activity.mjs
// ---------------------------------------------------------------------------

describe('tools/create_activity.mjs', async () => {
  const tool = (await import('../tools/create_activity.mjs')).default;

  it('POSTs to /activities', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 60, subject: 'Call', type: 'call' } });
    await tool.execute({ subject: 'Call', type: 'call' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/activities'));
  });

  it('sends subject and type in body', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 60, subject: 'Meeting', type: 'meeting' } });
    await tool.execute({ subject: 'Meeting', type: 'meeting' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.subject, 'Meeting');
    assert.equal(body.type, 'meeting');
  });

  it('includes optional dueDate, dealId, personId', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 61, subject: 'Task', type: 'task' } });
    await tool.execute({ subject: 'Task', type: 'task', dueDate: '2025-07-01', dealId: 5, personId: 3 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.due_date, '2025-07-01');
    assert.equal(body.deal_id, 5);
    assert.equal(body.person_id, 3);
  });

  it('returns success message with type and subject', async () => {
    const { ctx } = makeCtx({ data: { id: 62, subject: 'Email', type: 'email' } });
    const out = await tool.execute({ subject: 'Email', type: 'email' }, ctx);
    assert.ok(out.includes('email'));
    assert.ok(out.includes('Email'));
    assert.ok(out.includes('62'));
  });
});

// ---------------------------------------------------------------------------
// tools/add_note.mjs
// ---------------------------------------------------------------------------

describe('tools/add_note.mjs', async () => {
  const tool = (await import('../tools/add_note.mjs')).default;

  it('POSTs to /notes', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 70 } });
    await tool.execute({ content: 'Note text' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/notes'));
  });

  it('sends content in body', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 70 } });
    await tool.execute({ content: 'Important note' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.content, 'Important note');
  });

  it('attaches to deal when dealId provided', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 71 } });
    await tool.execute({ content: 'Note', dealId: 5 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.deal_id, 5);
  });

  it('attaches to person when personId provided', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 72 } });
    await tool.execute({ content: 'Note', personId: 10 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.person_id, 10);
  });

  it('attaches to org when orgId provided', async () => {
    const { ctx, getCall } = makeCtx({ data: { id: 73 } });
    await tool.execute({ content: 'Note', orgId: 20 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.org_id, 20);
  });

  it('returns success message with id', async () => {
    const { ctx } = makeCtx({ data: { id: 74 } });
    const out = await tool.execute({ content: 'Done note', dealId: 1 }, ctx);
    assert.ok(out.includes('74'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(400);
    await assert.rejects(() => tool.execute({ content: 'X' }, ctx), /Pipedrive API 400/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_pipelines.mjs
// ---------------------------------------------------------------------------

describe('tools/list_pipelines.mjs', async () => {
  const tool = (await import('../tools/list_pipelines.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /pipelines', async () => {
    const responses = [{ data: [] }];
    const { ctx, getCall } = makeCtx(null, { responses });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('/pipelines'));
  });

  it('returns "No pipelines found." when empty', async () => {
    const responses = [{ data: [] }];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No pipelines found.');
  });

  it('lists pipelines and fetches stages for each', async () => {
    const responses = [
      { data: [{ id: 1, name: 'Sales Pipeline' }] },
      { data: [{ id: 10, name: 'Qualified', order_nr: 1 }, { id: 11, name: 'Proposal', order_nr: 2 }] },
    ];
    const { ctx, getCalls } = makeCtx(null, { responses });
    const out = await tool.execute({}, ctx);
    assert.ok(getCalls()[0].url.includes('/pipelines'));
    assert.ok(getCalls()[1].url.includes('/stages?pipeline_id=1'));
    assert.ok(out.includes('Sales Pipeline'));
    assert.ok(out.includes('Qualified'));
    assert.ok(out.includes('Proposal'));
    assert.ok(out.includes('[id: 1]'));
    assert.ok(out.includes('[id: 10]'));
  });

  it('handles pipelines with no stages', async () => {
    const responses = [
      { data: [{ id: 2, name: 'Empty Pipeline' }] },
      { data: [] },
    ];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Empty Pipeline'));
  });
});
