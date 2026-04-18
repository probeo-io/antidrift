/**
 * Comprehensive unit tests for mcp-hubspot-crm tools
 * Tests all tools/*.mjs files and lib/client.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

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
    ctx: { credentials: { accessToken: 'test-access-token' }, fetch },
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
  const { createClient, formatContact, formatCompany, formatDeal,
    CONTACT_PROPERTIES, COMPANY_PROPERTIES, DEAL_PROPERTIES,
    searchPropertiesForType } = await import('../lib/client.mjs');

  it('sends Authorization Bearer header', async () => {
    const { ctx, getCall } = makeCtx({ id: '1', properties: {} });
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/crm/v3/objects/contacts/1');
    assert.equal(getCall().opts.headers['Authorization'], 'Bearer test-access-token');
  });

  it('sends Content-Type application/json header', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/crm/v3/objects/contacts');
    assert.equal(getCall().opts.headers['Content-Type'], 'application/json');
  });

  it('builds correct URL from path', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/crm/v3/objects/contacts?limit=5');
    assert.ok(getCall().url.startsWith('https://api.hubapi.com'));
    assert.ok(getCall().url.includes('/crm/v3/objects/contacts'));
  });

  it('serializes body as JSON for POST', async () => {
    const { ctx, getCall } = makeCtx({ id: '99' });
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('POST', '/crm/v3/objects/contacts', { properties: { email: 'a@b.com' } });
    const parsed = JSON.parse(getCall().opts.body);
    assert.equal(parsed.properties.email, 'a@b.com');
  });

  it('omits body for GET requests', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/crm/v3/objects/contacts');
    assert.equal(getCall().opts.body, undefined);
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401, 'Unauthorized');
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => hubspot('GET', '/crm/v3/objects/contacts'), /HubSpot API 401/);
  });

  it('throws on 500 server error', async () => {
    const { ctx } = makeErrCtx(500, 'Internal Server Error');
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => hubspot('GET', '/crm/v3/objects/contacts'), /HubSpot API 500/);
  });

  it('formatContact — full name and email', () => {
    const line = formatContact({ id: '1', properties: { firstname: 'Jane', lastname: 'Doe', email: 'jane@example.com' } });
    assert.ok(line.includes('Jane Doe'));
    assert.ok(line.includes('jane@example.com'));
    assert.ok(line.includes('[id: 1]'));
  });

  it('formatContact — missing name falls back to Unknown', () => {
    const line = formatContact({ id: '2', properties: {} });
    assert.ok(line.includes('Unknown'));
  });

  it('formatCompany — name and domain', () => {
    const line = formatCompany({ id: '10', properties: { name: 'Acme', domain: 'acme.com' } });
    assert.ok(line.includes('Acme'));
    assert.ok(line.includes('acme.com'));
    assert.ok(line.includes('[id: 10]'));
  });

  it('formatDeal — name, stage, amount', () => {
    const line = formatDeal({ id: '20', properties: { dealname: 'Big Deal', dealstage: 'closedwon', amount: '50000' } });
    assert.ok(line.includes('Big Deal'));
    assert.ok(line.includes('closedwon'));
    assert.ok(line.includes('50000'));
    assert.ok(line.includes('[id: 20]'));
  });

  it('CONTACT_PROPERTIES exports an array with email', () => {
    assert.ok(Array.isArray(CONTACT_PROPERTIES));
    assert.ok(CONTACT_PROPERTIES.includes('email'));
  });

  it('COMPANY_PROPERTIES exports an array with name', () => {
    assert.ok(Array.isArray(COMPANY_PROPERTIES));
    assert.ok(COMPANY_PROPERTIES.includes('name'));
  });

  it('DEAL_PROPERTIES exports an array with dealname', () => {
    assert.ok(Array.isArray(DEAL_PROPERTIES));
    assert.ok(DEAL_PROPERTIES.includes('dealname'));
  });

  it('searchPropertiesForType returns correct fields for contacts', () => {
    const props = searchPropertiesForType('contacts');
    assert.ok(props.includes('email'));
  });

  it('searchPropertiesForType returns correct fields for companies', () => {
    const props = searchPropertiesForType('companies');
    assert.ok(props.includes('name'));
  });

  it('searchPropertiesForType returns [] for unknown type', () => {
    assert.deepEqual(searchPropertiesForType('unknown'), []);
  });
});

// ---------------------------------------------------------------------------
// tools/list_contacts.mjs
// ---------------------------------------------------------------------------

describe('tools/list_contacts.mjs', async () => {
  const tool = (await import('../tools/list_contacts.mjs')).default;

  it('has description string', () => {
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 0);
  });

  it('has input object', () => {
    assert.equal(typeof tool.input, 'object');
  });

  it('has execute function', () => {
    assert.equal(typeof tool.execute, 'function');
  });

  it('calls GET /crm/v3/objects/contacts with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/crm/v3/objects/contacts'));
    assert.ok(getCall().url.includes('limit=5'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns formatted contact lines', async () => {
    const results = [
      { id: '1', properties: { firstname: 'Alice', lastname: 'Smith', email: 'alice@ex.com' } },
      { id: '2', properties: { firstname: 'Bob', lastname: 'Jones', email: 'bob@ex.com' } },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ limit: 20 }, ctx);
    assert.ok(out.includes('Alice Smith'));
    assert.ok(out.includes('bob@ex.com'));
  });

  it('returns "No contacts found." for empty results', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ limit: 20 }, ctx);
    assert.equal(out, 'No contacts found.');
  });

  it('uses search POST when query is provided', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ query: 'alice' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/contacts/search'));
  });

  it('returns no-match message when search returns empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ query: 'nobody' }, ctx);
    assert.ok(out.includes('nobody'));
    assert.ok(out.includes('No contacts matching'));
  });

  it('default limit is 20', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_contact.mjs
// ---------------------------------------------------------------------------

describe('tools/get_contact.mjs', async () => {
  const tool = (await import('../tools/get_contact.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.input, 'object');
    assert.equal(typeof tool.execute, 'function');
  });

  it('calls correct URL for contactId', async () => {
    const { ctx, getCall } = makeCtx({ id: '42', properties: {} });
    await tool.execute({ contactId: '42' }, ctx);
    assert.ok(getCall().url.includes('/contacts/42'));
  });

  it('returns formatted contact details', async () => {
    const { ctx } = makeCtx({
      id: '42',
      properties: { firstname: 'Test', lastname: 'User', email: 't@t.com', phone: '555-0000', company: 'Testco', jobtitle: 'Dev', lifecyclestage: 'lead' }
    });
    const out = await tool.execute({ contactId: '42' }, ctx);
    assert.ok(out.includes('Test User'));
    assert.ok(out.includes('t@t.com'));
    assert.ok(out.includes('555-0000'));
    assert.ok(out.includes('Testco'));
    assert.ok(out.includes('Dev'));
    assert.ok(out.includes('lead'));
    assert.ok(out.includes('[id: 42]'));
  });

  it('handles missing optional properties gracefully', async () => {
    const { ctx } = makeCtx({ id: '7', properties: { email: 'x@x.com' } });
    const out = await tool.execute({ contactId: '7' }, ctx);
    assert.ok(out.includes('[id: 7]'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404, 'Not Found');
    await assert.rejects(() => tool.execute({ contactId: '999' }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/create_contact.mjs
// ---------------------------------------------------------------------------

describe('tools/create_contact.mjs', async () => {
  const tool = (await import('../tools/create_contact.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.input, 'object');
    assert.equal(typeof tool.execute, 'function');
  });

  it('POSTs to /crm/v3/objects/contacts', async () => {
    const { ctx, getCall } = makeCtx({ id: '55' });
    await tool.execute({ email: 'new@test.com' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/crm/v3/objects/contacts'));
  });

  it('sends email in properties', async () => {
    const { ctx, getCall } = makeCtx({ id: '55' });
    await tool.execute({ email: 'new@test.com' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.email, 'new@test.com');
  });

  it('includes optional fields when provided', async () => {
    const { ctx, getCall } = makeCtx({ id: '56' });
    await tool.execute({ email: 'a@b.com', firstName: 'Ann', lastName: 'Lee', phone: '555', company: 'Corp', jobTitle: 'CTO' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.firstname, 'Ann');
    assert.equal(body.properties.lastname, 'Lee');
    assert.equal(body.properties.phone, '555');
    assert.equal(body.properties.company, 'Corp');
    assert.equal(body.properties.jobtitle, 'CTO');
  });

  it('does not include undefined optional fields', async () => {
    const { ctx, getCall } = makeCtx({ id: '57' });
    await tool.execute({ email: 'min@test.com' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.firstname, undefined);
    assert.equal(body.properties.phone, undefined);
  });

  it('returns success message with id', async () => {
    const { ctx } = makeCtx({ id: '99' });
    const out = await tool.execute({ email: 'x@x.com' }, ctx);
    assert.ok(out.includes('99'));
    assert.ok(out.includes('x@x.com'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(409, 'Conflict');
    await assert.rejects(() => tool.execute({ email: 'dup@test.com' }, ctx), /HubSpot API 409/);
  });
});

// ---------------------------------------------------------------------------
// tools/update_contact.mjs
// ---------------------------------------------------------------------------

describe('tools/update_contact.mjs', async () => {
  const tool = (await import('../tools/update_contact.mjs')).default;

  it('PATCHes to correct contact URL', async () => {
    const { ctx, getCall } = makeCtx({ id: '10' });
    await tool.execute({ contactId: '10', properties: { phone: '999' } }, ctx);
    assert.equal(getCall().opts.method, 'PATCH');
    assert.ok(getCall().url.includes('/contacts/10'));
  });

  it('sends properties in body', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ contactId: '10', properties: { jobtitle: 'Engineer' } }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.jobtitle, 'Engineer');
  });

  it('returns success message with contactId', async () => {
    const { ctx } = makeCtx({});
    const out = await tool.execute({ contactId: '10', properties: {} }, ctx);
    assert.ok(out.includes('10'));
  });

  it('throws on 404', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ contactId: 'bad', properties: {} }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_companies.mjs
// ---------------------------------------------------------------------------

describe('tools/list_companies.mjs', async () => {
  const tool = (await import('../tools/list_companies.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs companies with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/crm/v3/objects/companies'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns formatted company lines', async () => {
    const results = [{ id: '1', properties: { name: 'WidgetCo', domain: 'widget.co' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ limit: 20 }, ctx);
    assert.ok(out.includes('WidgetCo'));
    assert.ok(out.includes('widget.co'));
  });

  it('returns "No companies found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ limit: 20 }, ctx);
    assert.equal(out, 'No companies found.');
  });

  it('uses search POST when query is provided', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ query: 'widget' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/companies/search'));
  });

  it('returns no-match message for empty search', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ query: 'nope' }, ctx);
    assert.ok(out.includes('nope'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_company.mjs
// ---------------------------------------------------------------------------

describe('tools/get_company.mjs', async () => {
  const tool = (await import('../tools/get_company.mjs')).default;

  it('calls correct URL', async () => {
    const { ctx, getCall } = makeCtx({ id: '5', properties: {} });
    await tool.execute({ companyId: '5' }, ctx);
    assert.ok(getCall().url.includes('/companies/5'));
  });

  it('returns company details', async () => {
    const { ctx } = makeCtx({
      id: '5',
      properties: { name: 'TechCorp', domain: 'tech.com', industry: 'Technology', numberofemployees: '200', annualrevenue: '1000000' }
    });
    const out = await tool.execute({ companyId: '5' }, ctx);
    assert.ok(out.includes('TechCorp'));
    assert.ok(out.includes('tech.com'));
    assert.ok(out.includes('Technology'));
    assert.ok(out.includes('200 employees'));
    assert.ok(out.includes('1000000'));
    assert.ok(out.includes('[id: 5]'));
  });

  it('handles missing optional properties', async () => {
    const { ctx } = makeCtx({ id: '6', properties: { name: 'Minimal' } });
    const out = await tool.execute({ companyId: '6' }, ctx);
    assert.ok(out.includes('Minimal'));
    assert.ok(out.includes('[id: 6]'));
  });

  it('throws on error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ companyId: 'bad' }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/create_company.mjs
// ---------------------------------------------------------------------------

describe('tools/create_company.mjs', async () => {
  const tool = (await import('../tools/create_company.mjs')).default;

  it('POSTs to /crm/v3/objects/companies', async () => {
    const { ctx, getCall } = makeCtx({ id: '33' });
    await tool.execute({ name: 'NewCo' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/crm/v3/objects/companies'));
  });

  it('includes name in properties', async () => {
    const { ctx, getCall } = makeCtx({ id: '33' });
    await tool.execute({ name: 'NewCo' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.name, 'NewCo');
  });

  it('includes optional domain and industry', async () => {
    const { ctx, getCall } = makeCtx({ id: '34' });
    await tool.execute({ name: 'X', domain: 'x.com', industry: 'Tech' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.domain, 'x.com');
    assert.equal(body.properties.industry, 'Tech');
  });

  it('returns success message with id', async () => {
    const { ctx } = makeCtx({ id: '33' });
    const out = await tool.execute({ name: 'NewCo' }, ctx);
    assert.ok(out.includes('NewCo'));
    assert.ok(out.includes('33'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(400);
    await assert.rejects(() => tool.execute({ name: 'Bad' }, ctx), /HubSpot API 400/);
  });
});

// ---------------------------------------------------------------------------
// tools/update_company.mjs
// ---------------------------------------------------------------------------

describe('tools/update_company.mjs', async () => {
  const tool = (await import('../tools/update_company.mjs')).default;

  it('PATCHes to correct URL', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ companyId: '20', properties: { industry: 'Finance' } }, ctx);
    assert.equal(getCall().opts.method, 'PATCH');
    assert.ok(getCall().url.includes('/companies/20'));
  });

  it('sends properties in body', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ companyId: '20', properties: { name: 'Updated' } }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.name, 'Updated');
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({});
    const out = await tool.execute({ companyId: '20', properties: {} }, ctx);
    assert.ok(out.includes('20'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_deals.mjs
// ---------------------------------------------------------------------------

describe('tools/list_deals.mjs', async () => {
  const tool = (await import('../tools/list_deals.mjs')).default;

  it('GETs deals with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/crm/v3/objects/deals'));
    assert.ok(getCall().url.includes('limit=5'));
  });

  it('returns formatted deal lines', async () => {
    const results = [{ id: '1', properties: { dealname: 'Big Deal', dealstage: 'closedwon', amount: '99000' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Big Deal'));
    assert.ok(out.includes('closedwon'));
  });

  it('returns "No deals found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No deals found.');
  });

  it('uses search POST when query provided', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ query: 'enterprise' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
  });
});

// ---------------------------------------------------------------------------
// tools/get_deal.mjs
// ---------------------------------------------------------------------------

describe('tools/get_deal.mjs', async () => {
  const tool = (await import('../tools/get_deal.mjs')).default;

  it('calls correct URL', async () => {
    const { ctx, getCall } = makeCtx({ id: '99', properties: {} });
    await tool.execute({ dealId: '99' }, ctx);
    assert.ok(getCall().url.includes('/deals/99'));
  });

  it('returns deal details', async () => {
    const { ctx } = makeCtx({
      id: '99',
      properties: { dealname: 'Enterprise', dealstage: 'negotiation', pipeline: 'default', amount: '250000', closedate: '2025-12-31' }
    });
    const out = await tool.execute({ dealId: '99' }, ctx);
    assert.ok(out.includes('Enterprise'));
    assert.ok(out.includes('negotiation'));
    assert.ok(out.includes('default'));
    assert.ok(out.includes('250000'));
    assert.ok(out.includes('2025-12-31'));
    assert.ok(out.includes('[id: 99]'));
  });

  it('handles missing optional fields', async () => {
    const { ctx } = makeCtx({ id: '100', properties: { dealname: 'Simple' } });
    const out = await tool.execute({ dealId: '100' }, ctx);
    assert.ok(out.includes('Simple'));
    assert.ok(out.includes('[id: 100]'));
  });
});

// ---------------------------------------------------------------------------
// tools/create_deal.mjs
// ---------------------------------------------------------------------------

describe('tools/create_deal.mjs', async () => {
  const tool = (await import('../tools/create_deal.mjs')).default;

  it('POSTs to /crm/v3/objects/deals', async () => {
    const { ctx, getCall } = makeCtx({ id: '77' });
    await tool.execute({ name: 'New Deal' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/crm/v3/objects/deals'));
  });

  it('sets dealname from name', async () => {
    const { ctx, getCall } = makeCtx({ id: '77' });
    await tool.execute({ name: 'My Deal' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.dealname, 'My Deal');
  });

  it('includes optional amount, stage, pipeline, closeDate', async () => {
    const { ctx, getCall } = makeCtx({ id: '78' });
    await tool.execute({ name: 'Full Deal', amount: '50000', stage: 'proposal', pipeline: 'sales', closeDate: '2025-06-01' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.amount, '50000');
    assert.equal(body.properties.dealstage, 'proposal');
    assert.equal(body.properties.pipeline, 'sales');
    assert.equal(body.properties.closedate, '2025-06-01');
  });

  it('returns success message with id and name', async () => {
    const { ctx } = makeCtx({ id: '77' });
    const out = await tool.execute({ name: 'New Deal' }, ctx);
    assert.ok(out.includes('New Deal'));
    assert.ok(out.includes('77'));
  });
});

// ---------------------------------------------------------------------------
// tools/update_deal.mjs
// ---------------------------------------------------------------------------

describe('tools/update_deal.mjs', async () => {
  const tool = (await import('../tools/update_deal.mjs')).default;

  it('PATCHes to correct URL', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ dealId: '50', properties: { amount: '75000' } }, ctx);
    assert.equal(getCall().opts.method, 'PATCH');
    assert.ok(getCall().url.includes('/deals/50'));
  });

  it('sends properties in body', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ dealId: '50', properties: { dealstage: 'closedwon' } }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.dealstage, 'closedwon');
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({});
    const out = await tool.execute({ dealId: '50', properties: {} }, ctx);
    assert.ok(out.includes('50'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_leads.mjs
// ---------------------------------------------------------------------------

describe('tools/list_leads.mjs', async () => {
  const tool = (await import('../tools/list_leads.mjs')).default;

  it('GETs leads with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/crm/v3/objects/leads'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns formatted lead lines', async () => {
    const results = [{ id: '5', properties: { firstname: 'Lead', lastname: 'Person', email: 'lead@ex.com' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Lead Person'));
    assert.ok(out.includes('lead@ex.com'));
    assert.ok(out.includes('[id: 5]'));
  });

  it('returns "No leads found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No leads found.');
  });
});

// ---------------------------------------------------------------------------
// tools/get_lead.mjs
// ---------------------------------------------------------------------------

describe('tools/get_lead.mjs', async () => {
  const tool = (await import('../tools/get_lead.mjs')).default;

  it('calls correct URL', async () => {
    const { ctx, getCall } = makeCtx({ id: '8', properties: {} });
    await tool.execute({ leadId: '8' }, ctx);
    assert.ok(getCall().url.includes('/leads/8'));
  });

  it('returns lead details', async () => {
    const { ctx } = makeCtx({
      id: '8',
      properties: { firstname: 'Lead', lastname: 'User', email: 'l@ex.com', phone: '111', company: 'LeadCo', lifecyclestage: 'lead', hs_lead_status: 'OPEN' }
    });
    const out = await tool.execute({ leadId: '8' }, ctx);
    assert.ok(out.includes('Lead User'));
    assert.ok(out.includes('l@ex.com'));
    assert.ok(out.includes('111'));
    assert.ok(out.includes('LeadCo'));
    assert.ok(out.includes('OPEN'));
    assert.ok(out.includes('[id: 8]'));
  });

  it('handles missing optional properties', async () => {
    const { ctx } = makeCtx({ id: '9', properties: {} });
    const out = await tool.execute({ leadId: '9' }, ctx);
    assert.ok(out.includes('[id: 9]'));
  });
});

// ---------------------------------------------------------------------------
// tools/create_lead.mjs
// ---------------------------------------------------------------------------

describe('tools/create_lead.mjs', async () => {
  const tool = (await import('../tools/create_lead.mjs')).default;

  it('POSTs to /crm/v3/objects/leads', async () => {
    const { ctx, getCall } = makeCtx({ id: '11' });
    await tool.execute({ email: 'l@test.com' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/crm/v3/objects/leads'));
  });

  it('sends email in properties', async () => {
    const { ctx, getCall } = makeCtx({ id: '11' });
    await tool.execute({ email: 'l@test.com' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.email, 'l@test.com');
  });

  it('includes optional name fields', async () => {
    const { ctx, getCall } = makeCtx({ id: '12' });
    await tool.execute({ email: 'x@y.com', firstName: 'John', lastName: 'Doe', phone: '555', company: 'Corp' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.firstname, 'John');
    assert.equal(body.properties.lastname, 'Doe');
  });

  it('returns success message with id', async () => {
    const { ctx } = makeCtx({ id: '13' });
    const out = await tool.execute({ email: 'new@lead.com' }, ctx);
    assert.ok(out.includes('13'));
  });
});

// ---------------------------------------------------------------------------
// tools/update_lead.mjs
// ---------------------------------------------------------------------------

describe('tools/update_lead.mjs', async () => {
  const tool = (await import('../tools/update_lead.mjs')).default;

  it('PATCHes to correct URL', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ leadId: '30', properties: { hs_lead_status: 'OPEN' } }, ctx);
    assert.equal(getCall().opts.method, 'PATCH');
    assert.ok(getCall().url.includes('/leads/30'));
  });

  it('sends properties in body', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ leadId: '30', properties: { hs_lead_status: 'CLOSED' } }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.properties.hs_lead_status, 'CLOSED');
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({});
    const out = await tool.execute({ leadId: '30', properties: {} }, ctx);
    assert.ok(out.includes('30'));
  });
});

// ---------------------------------------------------------------------------
// tools/add_note.mjs
// ---------------------------------------------------------------------------

describe('tools/add_note.mjs', async () => {
  const tool = (await import('../tools/add_note.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('creates note then associates to contact', async () => {
    const noteResponse = { id: 'note-1' };
    const assocResponse = {};
    const responses = [noteResponse, assocResponse];
    const { ctx, getCalls } = makeCtx(null, { responses });
    const out = await tool.execute({ objectType: 'contacts', objectId: 'c-1', body: 'Test note' }, ctx);
    const calls = getCalls();
    assert.equal(calls[0].opts.method, 'POST');
    assert.ok(calls[0].url.includes('/crm/v3/objects/notes'));
    assert.equal(calls[1].opts.method, 'PUT');
    assert.ok(calls[1].url.includes('notes/note-1/associations/contacts/c-1'));
    assert.ok(out.includes('contacts'));
    assert.ok(out.includes('c-1'));
    assert.ok(out.includes('note-1'));
  });

  it('uses associationTypeId 190 for companies', async () => {
    const responses = [{ id: 'note-2' }, {}];
    const { ctx, getCalls } = makeCtx(null, { responses });
    await tool.execute({ objectType: 'companies', objectId: 'co-1', body: 'Note' }, ctx);
    const assocBody = JSON.parse(getCalls()[1].opts.body);
    assert.equal(assocBody[0].associationTypeId, 190);
  });

  it('uses associationTypeId 214 for deals', async () => {
    const responses = [{ id: 'note-3' }, {}];
    const { ctx, getCalls } = makeCtx(null, { responses });
    await tool.execute({ objectType: 'deals', objectId: 'd-1', body: 'Note' }, ctx);
    const assocBody = JSON.parse(getCalls()[1].opts.body);
    assert.equal(assocBody[0].associationTypeId, 214);
  });

  it('uses associationTypeId 202 for contacts', async () => {
    const responses = [{ id: 'note-4' }, {}];
    const { ctx, getCalls } = makeCtx(null, { responses });
    await tool.execute({ objectType: 'contacts', objectId: 'c-2', body: 'Note' }, ctx);
    const assocBody = JSON.parse(getCalls()[1].opts.body);
    assert.equal(assocBody[0].associationTypeId, 202);
  });

  it('note body sets hs_note_body', async () => {
    const responses = [{ id: 'n5' }, {}];
    const { ctx, getCalls } = makeCtx(null, { responses });
    await tool.execute({ objectType: 'contacts', objectId: 'c-3', body: 'My important note' }, ctx);
    const noteBody = JSON.parse(getCalls()[0].opts.body);
    assert.equal(noteBody.properties.hs_note_body, 'My important note');
  });
});

// ---------------------------------------------------------------------------
// tools/list_activities.mjs
// ---------------------------------------------------------------------------

describe('tools/list_activities.mjs', async () => {
  const tool = (await import('../tools/list_activities.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('fetches associations for the object', async () => {
    const responses = [{ results: [] }];
    const { ctx, getCall } = makeCtx(null, { responses });
    const out = await tool.execute({ objectType: 'contacts', objectId: 'c-1', limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/contacts/c-1/associations/notes'));
    assert.equal(out, 'No notes found for contacts c-1.');
  });

  it('fetches each note and returns formatted lines', async () => {
    const timestamp = new Date('2024-01-15').toISOString();
    const responses = [
      { results: [{ toObjectId: 'n-1' }, { toObjectId: 'n-2' }] },
      { id: 'n-1', properties: { hs_note_body: 'First note', hs_timestamp: timestamp } },
      { id: 'n-2', properties: { hs_note_body: 'Second note', hs_timestamp: timestamp } },
    ];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ objectType: 'contacts', objectId: 'c-1', limit: 10 }, ctx);
    assert.ok(out.includes('First note'));
    assert.ok(out.includes('Second note'));
    assert.ok(out.includes('n-1'));
    assert.ok(out.includes('n-2'));
  });

  it('respects limit on note ids', async () => {
    const responses = [
      { results: [{ toObjectId: 'n1' }, { toObjectId: 'n2' }, { toObjectId: 'n3' }] },
      { id: 'n1', properties: { hs_note_body: 'Note1', hs_timestamp: new Date().toISOString() } },
    ];
    const { ctx, getCalls } = makeCtx(null, { responses });
    await tool.execute({ objectType: 'contacts', objectId: 'c-1', limit: 1 }, ctx);
    // Only 1 note should be fetched
    assert.equal(getCalls().length, 2);
  });
});

// ---------------------------------------------------------------------------
// tools/search.mjs
// ---------------------------------------------------------------------------

describe('tools/search.mjs', async () => {
  const tool = (await import('../tools/search.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('POSTs to objectType search endpoint', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ objectType: 'contacts', query: 'alice', limit: 5 }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/contacts/search'));
  });

  it('returns contact results formatted', async () => {
    const results = [{ id: '1', properties: { firstname: 'Alice', lastname: 'W', email: 'aw@ex.com' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ objectType: 'contacts', query: 'alice' }, ctx);
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('aw@ex.com'));
  });

  it('returns company results formatted', async () => {
    const results = [{ id: '10', properties: { name: 'BigCo', domain: 'big.co' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ objectType: 'companies', query: 'big' }, ctx);
    assert.ok(out.includes('BigCo'));
  });

  it('returns deal results formatted', async () => {
    const results = [{ id: '20', properties: { dealname: 'Enterprise', dealstage: 'proposal', amount: '100000' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ objectType: 'deals', query: 'enterprise' }, ctx);
    assert.ok(out.includes('Enterprise'));
  });

  it('returns no-match message when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ objectType: 'contacts', query: 'nobody' }, ctx);
    assert.ok(out.includes('nobody'));
    assert.ok(out.includes('No contacts'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_forecasts.mjs
// ---------------------------------------------------------------------------

describe('tools/list_forecasts.mjs', async () => {
  const tool = (await import('../tools/list_forecasts.mjs')).default;

  it('GETs forecasts with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/crm/v3/objects/forecasts'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns "No forecasts found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No forecasts found.');
  });

  it('returns forecast records', async () => {
    const results = [{ id: 'f1', properties: { amount: '50000', closedate: '2025-06-01' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('f1'));
    assert.ok(out.includes('50000'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_line_items.mjs
// ---------------------------------------------------------------------------

describe('tools/list_line_items.mjs', async () => {
  const tool = (await import('../tools/list_line_items.mjs')).default;

  it('GETs line items', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/crm/v3/objects/line_items'));
    assert.ok(getCall().url.includes('limit=5'));
  });

  it('returns "No line items found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No line items found.');
  });

  it('returns formatted line item with quantity and price', async () => {
    const results = [{ id: 'li1', properties: { name: 'Widget', quantity: '3', price: '9.99', amount: '29.97' } }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Widget'));
    assert.ok(out.includes('3'));
    assert.ok(out.includes('9.99'));
    assert.ok(out.includes('29.97'));
    assert.ok(out.includes('[id: li1]'));
  });
});
