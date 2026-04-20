/**
 * Comprehensive unit tests for mcp-attio zeromcp tools.
 * Tests each tools/*.mjs file's structure and execute() behavior,
 * plus lib/client.mjs directly.
 *
 * Run: node --test test/tools.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, formatPerson, formatCompany, formatDeal } from '../lib/client.mjs';

import listPeople from '../tools/list_people.mjs';
import listCompanies from '../tools/list_companies.mjs';
import listDeals from '../tools/list_deals.mjs';
import searchPeople from '../tools/search_people.mjs';
import searchCompanies from '../tools/search_companies.mjs';
import getPerson from '../tools/get_person.mjs';
import createPerson from '../tools/create_person.mjs';
import createCompany from '../tools/create_company.mjs';
import createTask from '../tools/create_task.mjs';
import completeTask from '../tools/complete_task.mjs';
import addNote from '../tools/add_note.mjs';
import listTasks from '../tools/list_tasks.mjs';
import moveDeal from '../tools/move_deal.mjs';
import updateRecord from '../tools/update_record.mjs';
import createDeal from '../tools/create_deal.mjs';
import deleteDeal from '../tools/delete_deal.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ATTIO_API_BASE = 'https://api.attio.com/v2';

/**
 * Creates a mock ctx. responseData is the full response body.
 * Attio credentials use `apiKey` (Authorization: Bearer <apiKey>).
 */
function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200 } = opts;
  let capturedUrl, capturedOpts;
  const fetch = async (url, reqOpts) => {
    capturedUrl = url;
    capturedOpts = reqOpts;
    return {
      ok,
      status,
      text: async () => ok ? JSON.stringify(responseData) : 'API Error',
      json: async () => responseData
    };
  };
  return {
    ctx: { credentials: { apiKey: 'test-attio-key' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts })
  };
}

// Attio person record factory
function makePerson(overrides = {}) {
  return {
    id: { record_id: 'person-123' },
    values: {
      name: [{ full_name: 'Alice Smith', first_name: 'Alice' }],
      email_addresses: [{ email_address: 'alice@example.com' }],
      ...overrides.values
    },
    ...overrides
  };
}

// Attio company record factory
function makeCompany(overrides = {}) {
  return {
    id: { record_id: 'company-456' },
    values: {
      name: [{ value: 'Acme Corp' }],
      domains: [{ domain: 'acme.com' }],
      ...overrides.values
    },
    ...overrides
  };
}

// Attio deal record factory
function makeDeal(overrides = {}) {
  return {
    id: { record_id: 'deal-789' },
    values: {
      name: [{ value: 'Big Deal' }],
      stage: [{ status: { title: 'Qualified' } }],
      value: [{ currency_value: 50000 }],
      ...overrides.values
    },
    ...overrides
  };
}

const ALL_TOOLS = [
  listPeople, listCompanies, listDeals, searchPeople, searchCompanies,
  getPerson, createPerson, createCompany, createTask, completeTask,
  addNote, listTasks, moveDeal, updateRecord, createDeal, deleteDeal
];

// ---------------------------------------------------------------------------
// Structure tests
// ---------------------------------------------------------------------------

describe('tool structure', () => {
  for (const tool of ALL_TOOLS) {
    it(`${tool.description?.slice(0, 45) || '(unknown)'} — has required exports`, () => {
      assert.equal(typeof tool.description, 'string', 'description must be a string');
      assert.ok(tool.description.length > 0, 'description must be non-empty');
      assert.equal(typeof tool.input, 'object', 'input must be an object');
      assert.ok(tool.input !== null, 'input must not be null');
      assert.equal(typeof tool.execute, 'function', 'execute must be a function');
    });
  }

  it('all tools have non-empty descriptions (>=10 chars)', () => {
    for (const tool of ALL_TOOLS) {
      assert.ok(tool.description.length >= 10, `description too short: "${tool.description}"`);
    }
  });

  it('all input properties have type and description', () => {
    for (const tool of ALL_TOOLS) {
      for (const [key, prop] of Object.entries(tool.input)) {
        assert.ok(prop.type, `${tool.description.slice(0, 30)}.input.${key} missing type`);
        assert.ok(prop.description, `${tool.description.slice(0, 30)}.input.${key} missing description`);
      }
    }
  });

  it('tools that operate on records have recordId in input', () => {
    const needRecordId = [getPerson, completeTask, moveDeal, updateRecord];
    for (const tool of needRecordId) {
      const hasRecordId = tool.input.recordId || tool.input.taskId;
      assert.ok(hasRecordId, `${tool.description.slice(0, 30)} should have recordId or taskId`);
    }
  });
});

// ---------------------------------------------------------------------------
// lib/client.mjs — createClient
// ---------------------------------------------------------------------------

describe('createClient', () => {
  it('sets Authorization header with Bearer + apiKey', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('GET', '/objects/people/records/query');
    const { opts } = getCaptured();
    assert.ok(opts.headers['Authorization'], 'Authorization header should be set');
    assert.equal(opts.headers['Authorization'], 'Bearer test-attio-key');
  });

  it('sets Content-Type: application/json', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('POST', '/objects/people/records/query', { limit: 10 });
    const { opts } = getCaptured();
    assert.equal(opts.headers['Content-Type'], 'application/json');
  });

  it('constructs correct URL with v2 base path', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('GET', '/objects/people/records/rec-123');
    const { url } = getCaptured();
    assert.ok(url.startsWith(ATTIO_API_BASE), `URL should start with Attio base: ${url}`);
    assert.ok(url.includes('/objects/people/records/rec-123'), `URL: ${url}`);
  });

  it('uses provided fetchFn instead of global fetch', async () => {
    let wasCalled = false;
    const customFetch = async () => {
      wasCalled = true;
      return { ok: true, json: async () => ({ data: [] }) };
    };
    const { attio } = createClient({ apiKey: 'key' }, customFetch);
    await attio('GET', '/objects/companies/records/query');
    assert.ok(wasCalled);
  });

  it('sends JSON body for POST requests', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('POST', '/objects/people/records/query', { limit: 5, filter: { or: [] } });
    const { opts } = getCaptured();
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.limit, 5);
  });

  it('sends PATCH with body', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-123' } } });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('PATCH', '/objects/deals/records/deal-123', { data: { values: { stage: [{ status: 'Won' }] } } });
    const { opts } = getCaptured();
    assert.equal(opts.method, 'PATCH');
    const body = JSON.parse(opts.body);
    assert.ok(body.data.values.stage);
  });

  it('does not set body for GET requests (undefined body)', async () => {
    const { ctx, getCaptured } = makeCtx({ data: {} });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('GET', '/tasks?limit=10');
    const { opts } = getCaptured();
    assert.equal(opts.body, undefined);
  });

  it('throws on non-ok HTTP response with status code', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 404 });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => attio('GET', '/objects/people/records/nonexistent'),
      (err) => {
        assert.ok(err.message.includes('404'), `Error: ${err.message}`);
        return true;
      }
    );
  });

  it('throws on 401 unauthorized', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 401 });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => attio('GET', '/objects/people/records/query'),
      (err) => {
        assert.ok(err.message.includes('401'), `Error: ${err.message}`);
        return true;
      }
    );
  });

  it('throws on 403 forbidden', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => attio('POST', '/notes', { data: {} }),
      (err) => {
        assert.ok(err.message.includes('403'), `Error: ${err.message}`);
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// formatPerson, formatCompany, formatDeal helpers
// ---------------------------------------------------------------------------

describe('formatPerson', () => {
  it('formats a person with name and email', () => {
    const out = formatPerson(makePerson());
    assert.ok(out.includes('Alice Smith'));
    assert.ok(out.includes('alice@example.com'));
    assert.ok(out.includes('person-123'));
  });

  it('falls back to first_name if full_name missing', () => {
    const person = {
      id: { record_id: 'p-1' },
      values: {
        name: [{ first_name: 'Bob' }],
        email_addresses: []
      }
    };
    const out = formatPerson(person);
    assert.ok(out.includes('Bob'));
  });

  it('shows "Unknown" when no name', () => {
    const person = { id: { record_id: 'p-2' }, values: {} };
    const out = formatPerson(person);
    assert.ok(out.includes('Unknown'));
  });

  it('omits email line when no email', () => {
    const person = {
      id: { record_id: 'p-3' },
      values: { name: [{ full_name: 'No Email' }] }
    };
    const out = formatPerson(person);
    assert.ok(out.includes('No Email'));
    assert.ok(!out.includes('@'));
  });
});

describe('formatCompany', () => {
  it('formats a company with name and domain', () => {
    const out = formatCompany(makeCompany());
    assert.ok(out.includes('Acme Corp'));
    assert.ok(out.includes('acme.com'));
    assert.ok(out.includes('company-456'));
  });

  it('shows "Unknown" when no name value', () => {
    const company = { id: { record_id: 'c-1' }, values: {} };
    const out = formatCompany(company);
    assert.ok(out.includes('Unknown'));
  });

  it('omits domain when not present', () => {
    const company = {
      id: { record_id: 'c-2' },
      values: { name: [{ value: 'No Domain Corp' }] }
    };
    const out = formatCompany(company);
    assert.ok(out.includes('No Domain Corp'));
    assert.ok(!out.includes('.com'));
  });
});

describe('formatDeal', () => {
  it('formats a deal with name, stage, and value', () => {
    const out = formatDeal(makeDeal());
    assert.ok(out.includes('Big Deal'));
    assert.ok(out.includes('Qualified'));
    assert.ok(out.includes('50000'));
    assert.ok(out.includes('deal-789'));
  });

  it('shows "Unknown" when no name', () => {
    const deal = { id: { record_id: 'd-1' }, values: {} };
    const out = formatDeal(deal);
    assert.ok(out.includes('Unknown'));
  });

  it('omits stage and value when absent', () => {
    const deal = {
      id: { record_id: 'd-2' },
      values: { name: [{ value: 'Simple Deal' }] }
    };
    const out = formatDeal(deal);
    assert.ok(out.includes('Simple Deal'));
  });
});

// ---------------------------------------------------------------------------
// Tool: list_people
// ---------------------------------------------------------------------------

describe('list_people', () => {
  it('happy path — returns formatted people list', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makePerson()] });
    const result = await listPeople.execute({}, ctx);
    assert.ok(result.includes('Alice Smith'));
    assert.ok(result.includes('alice@example.com'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/people/records/query'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.limit, 20); // default
  });

  it('uses custom limit param', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makePerson()] });
    await listPeople.execute({ limit: 5 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.limit, 5);
  });

  it('returns "No people found." for empty data', async () => {
    const { ctx } = makeCtx({ data: [] });
    const result = await listPeople.execute({}, ctx);
    assert.equal(result, 'No people found.');
  });

  it('returns "No people found." when data is undefined', async () => {
    const { ctx } = makeCtx({});
    const result = await listPeople.execute({}, ctx);
    assert.equal(result, 'No people found.');
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 401 });
    await assert.rejects(() => listPeople.execute({}, ctx), /401/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_companies
// ---------------------------------------------------------------------------

describe('list_companies', () => {
  it('happy path — returns formatted companies list', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makeCompany()] });
    const result = await listCompanies.execute({}, ctx);
    assert.ok(result.includes('Acme Corp'));
    assert.ok(result.includes('acme.com'));
    const { url } = getCaptured();
    assert.ok(url.includes('/objects/companies/records/query'), `URL: ${url}`);
  });

  it('returns "No companies found." for empty data', async () => {
    const { ctx } = makeCtx({ data: [] });
    const result = await listCompanies.execute({}, ctx);
    assert.equal(result, 'No companies found.');
  });

  it('uses custom limit param', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makeCompany()] });
    await listCompanies.execute({ limit: 10 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.limit, 10);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    await assert.rejects(() => listCompanies.execute({}, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_deals
// ---------------------------------------------------------------------------

describe('list_deals', () => {
  it('happy path — returns formatted deals list', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makeDeal()] });
    const result = await listDeals.execute({}, ctx);
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('Qualified'));
    assert.ok(result.includes('50000'));
    const { url } = getCaptured();
    assert.ok(url.includes('/objects/deals/records/query'), `URL: ${url}`);
  });

  it('returns "No deals found." for empty data', async () => {
    const { ctx } = makeCtx({ data: [] });
    const result = await listDeals.execute({}, ctx);
    assert.equal(result, 'No deals found.');
  });

  it('uses custom limit param', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makeDeal()] });
    await listDeals.execute({ limit: 3 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.limit, 3);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => listDeals.execute({}, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: search_people
// ---------------------------------------------------------------------------

describe('search_people', () => {
  it('happy path — returns matching people', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makePerson()] });
    const result = await searchPeople.execute({ query: 'Alice' }, ctx);
    assert.ok(result.includes('Alice Smith'));
    assert.ok(result.includes('alice@example.com'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/people/records/query'), `URL: ${url}`);
    const body = JSON.parse(opts.body);
    assert.ok(body.filter, 'body should include filter');
    assert.ok(body.filter.or, 'filter should have or clause');
  });

  it('sends filter with name and email conditions', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    await searchPeople.execute({ query: 'test@example.com' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    const conditions = body.filter.or;
    assert.ok(Array.isArray(conditions), 'filter.or should be array');
    assert.equal(conditions.length, 2, 'should have 2 OR conditions');
    const attrs = conditions.map(c => c.attribute);
    assert.ok(attrs.includes('name'), 'should filter by name');
    assert.ok(attrs.includes('email_addresses'), 'should filter by email');
  });

  it('returns "No people matching..." for empty results', async () => {
    const { ctx } = makeCtx({ data: [] });
    const result = await searchPeople.execute({ query: 'nobody' }, ctx);
    assert.ok(result.includes('No people matching'));
    assert.ok(result.includes('nobody'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 404 });
    await assert.rejects(() => searchPeople.execute({ query: 'test' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: search_companies
// ---------------------------------------------------------------------------

describe('search_companies', () => {
  it('happy path — returns matching companies', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [makeCompany()] });
    const result = await searchCompanies.execute({ query: 'Acme' }, ctx);
    assert.ok(result.includes('Acme Corp'));
    assert.ok(result.includes('acme.com'));
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(body.filter.or, 'filter should have or clause');
  });

  it('sends filter with name and domain conditions', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    await searchCompanies.execute({ query: 'example.com' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    const conditions = body.filter.or;
    const attrs = conditions.map(c => c.attribute);
    assert.ok(attrs.includes('name'), 'should filter by name');
    assert.ok(attrs.includes('domains'), 'should filter by domain');
  });

  it('returns "No companies matching..." for empty results', async () => {
    const { ctx } = makeCtx({ data: [] });
    const result = await searchCompanies.execute({ query: 'noresult' }, ctx);
    assert.ok(result.includes('No companies matching'));
    assert.ok(result.includes('noresult'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => searchCompanies.execute({ query: 'test' }, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_person
// ---------------------------------------------------------------------------

describe('get_person', () => {
  it('happy path — returns full person detail', async () => {
    const { ctx, getCaptured } = makeCtx({
      data: {
        id: { record_id: 'rec-123' },
        values: {
          name: [{ full_name: 'Alice Smith' }],
          email_addresses: [{ email_address: 'alice@example.com' }],
          phone_numbers: [{ phone_number: '+1-555-1234' }],
          job_title: [{ value: 'CTO' }],
          description: [{ value: 'Founder & CTO' }]
        }
      }
    });
    const result = await getPerson.execute({ recordId: 'rec-123' }, ctx);
    assert.ok(result.includes('Alice Smith'));
    assert.ok(result.includes('alice@example.com'));
    assert.ok(result.includes('+1-555-1234'));
    assert.ok(result.includes('CTO'));
    assert.ok(result.includes('Founder & CTO'));
    assert.ok(result.includes('rec-123'));
    const { url } = getCaptured();
    assert.ok(url.includes('/objects/people/records/rec-123'), `URL: ${url}`);
    assert.ok(!url.endsWith('/query'), `Should be a direct record fetch: ${url}`);
  });

  it('handles person with minimal data', async () => {
    const { ctx } = makeCtx({
      data: {
        id: { record_id: 'rec-min' },
        values: {}
      }
    });
    const result = await getPerson.execute({ recordId: 'rec-min' }, ctx);
    assert.ok(result.includes('rec-min'));
    assert.ok(result.includes('Unknown'));
  });

  it('handles person with multiple emails', async () => {
    const { ctx } = makeCtx({
      data: {
        id: { record_id: 'rec-456' },
        values: {
          name: [{ full_name: 'Bob Jones' }],
          email_addresses: [
            { email_address: 'bob@work.com' },
            { email_address: 'bob@personal.com' }
          ]
        }
      }
    });
    const result = await getPerson.execute({ recordId: 'rec-456' }, ctx);
    assert.ok(result.includes('bob@work.com'));
    assert.ok(result.includes('bob@personal.com'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 404 });
    await assert.rejects(() => getPerson.execute({ recordId: 'nonexistent' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: create_person
// ---------------------------------------------------------------------------

describe('create_person', () => {
  it('happy path — creates person and returns confirmation', async () => {
    const { ctx, getCaptured } = makeCtx({
      data: { id: { record_id: 'new-person-123' } }
    });
    const result = await createPerson.execute({
      email: 'new@example.com',
      firstName: 'John',
      lastName: 'Doe'
    }, ctx);
    assert.ok(result.includes('John'));
    assert.ok(result.includes('Doe'));
    assert.ok(result.includes('new@example.com'));
    assert.ok(result.includes('new-person-123'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/people/records'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.email_addresses, [{ email_address: 'new@example.com' }]);
    assert.deepEqual(body.data.values.name, [{ first_name: 'John', last_name: 'Doe' }]);
  });

  it('includes job title when provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'p-1' } } });
    await createPerson.execute({
      email: 'cto@acme.com',
      firstName: 'Jane',
      jobTitle: 'CTO'
    }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.job_title, [{ value: 'CTO' }]);
  });

  it('omits name when neither firstName nor lastName provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'p-2' } } });
    await createPerson.execute({ email: 'anon@example.com' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.values.name, undefined);
  });

  it('omits jobTitle when not provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'p-3' } } });
    await createPerson.execute({ email: 'test@test.com', firstName: 'Test' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.values.job_title, undefined);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 422 });
    await assert.rejects(() => createPerson.execute({ email: 'x@x.com' }, ctx), /422/);
  });
});

// ---------------------------------------------------------------------------
// Tool: create_company
// ---------------------------------------------------------------------------

describe('create_company', () => {
  it('happy path — creates company with name only', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'co-123' } } });
    const result = await createCompany.execute({ name: 'Startup Inc' }, ctx);
    assert.ok(result.includes('Startup Inc'));
    assert.ok(result.includes('co-123'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/companies/records'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.name, [{ value: 'Startup Inc' }]);
  });

  it('includes domain when provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'co-456' } } });
    await createCompany.execute({ name: 'With Domain', domain: 'withdomain.io' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.domains, [{ domain: 'withdomain.io' }]);
  });

  it('omits domains when domain not provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'co-789' } } });
    await createCompany.execute({ name: 'No Domain Co' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.values.domains, undefined);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 400 });
    await assert.rejects(() => createCompany.execute({ name: 'Bad' }, ctx), /400/);
  });
});

// ---------------------------------------------------------------------------
// Tool: create_task
// ---------------------------------------------------------------------------

describe('create_task', () => {
  it('happy path — creates task with content only', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { task_id: 'task-123' } } });
    const result = await createTask.execute({ content: 'Follow up with Alice' }, ctx);
    assert.ok(result.includes('Follow up with Alice'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/tasks'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.ok(Array.isArray(body.data.content));
    assert.equal(body.data.content[0].children[0].text, 'Follow up with Alice');
    assert.equal(body.data.is_completed, false);
  });

  it('includes deadline when provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { task_id: 'task-456' } } });
    const result = await createTask.execute({
      content: 'Review proposal',
      deadlineAt: '2024-03-15T00:00:00Z'
    }, ctx);
    assert.ok(result.includes('2024-03-15'));
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.deadline_at, '2024-03-15T00:00:00Z');
  });

  it('links to record when linkedRecordId and linkedObjectType provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { task_id: 'task-789' } } });
    await createTask.execute({
      content: 'Call them',
      linkedRecordId: 'person-abc',
      linkedObjectType: 'people'
    }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(Array.isArray(body.data.linked_records));
    assert.equal(body.data.linked_records[0].target_object, 'people');
    assert.equal(body.data.linked_records[0].target_record_id, 'person-abc');
  });

  it('does not include linked_records when only one of the two link params provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { task_id: 'task-no-link' } } });
    await createTask.execute({ content: 'Task', linkedRecordId: 'abc' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.linked_records, undefined);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 422 });
    await assert.rejects(() => createTask.execute({ content: 'T' }, ctx), /422/);
  });
});

// ---------------------------------------------------------------------------
// Tool: complete_task
// ---------------------------------------------------------------------------

describe('complete_task', () => {
  it('happy path — marks task as completed', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { task_id: 'task-123' }, is_completed: true } });
    const result = await completeTask.execute({ taskId: 'task-123' }, ctx);
    assert.ok(result.includes('completed'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/tasks/task-123'), `URL: ${url}`);
    assert.equal(opts.method, 'PATCH');
    const body = JSON.parse(opts.body);
    assert.equal(body.data.is_completed, true);
  });

  it('uses correct task ID in URL', async () => {
    const { ctx, getCaptured } = makeCtx({ data: {} });
    await completeTask.execute({ taskId: 'my-special-task-id' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my-special-task-id'), `URL: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 404 });
    await assert.rejects(() => completeTask.execute({ taskId: 'nonexistent' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: add_note
// ---------------------------------------------------------------------------

describe('add_note', () => {
  it('happy path — adds note to people object', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { note_id: 'note-123' } } });
    const result = await addNote.execute({
      objectType: 'people',
      recordId: 'person-abc',
      title: 'Meeting Notes',
      content: 'Great conversation about the project.'
    }, ctx);
    assert.ok(result.includes('Meeting Notes'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/notes'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.data.title, 'Meeting Notes');
    assert.equal(body.data.parent_object, 'people');
    assert.equal(body.data.parent_record_id, 'person-abc');
    assert.ok(Array.isArray(body.data.content));
    assert.equal(body.data.content[0].children[0].text, 'Great conversation about the project.');
  });

  it('uses "companies" for non-people object type', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { note_id: 'note-456' } } });
    await addNote.execute({
      objectType: 'companies',
      recordId: 'co-abc',
      title: 'Company Notes',
      content: 'Signed the contract.'
    }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.parent_object, 'companies');
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    await assert.rejects(() => addNote.execute({
      objectType: 'people', recordId: 'p-1', title: 'T', content: 'C'
    }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_tasks
// ---------------------------------------------------------------------------

describe('list_tasks', () => {
  it('happy path — returns formatted task list', async () => {
    const { ctx, getCaptured } = makeCtx({
      data: [
        { id: { task_id: 'task-1' }, is_completed: false, content_plaintext: 'Call Alice', deadline_at: null },
        { id: { task_id: 'task-2' }, is_completed: true, content_plaintext: 'Send proposal', deadline_at: '2024-01-15T00:00:00Z' }
      ]
    });
    const result = await listTasks.execute({}, ctx);
    assert.ok(result.includes('Call Alice'));
    assert.ok(result.includes('task-1'));
    assert.ok(result.includes('Send proposal'));
    assert.ok(result.includes('task-2'));
    const { url } = getCaptured();
    assert.ok(url.includes('/tasks'), `URL: ${url}`);
    assert.ok(url.includes('limit=20'), `URL should have default limit: ${url}`);
  });

  it('returns "No tasks found." for empty data', async () => {
    const { ctx } = makeCtx({ data: [] });
    const result = await listTasks.execute({}, ctx);
    assert.equal(result, 'No tasks found.');
  });

  it('uses custom limit param', async () => {
    const { ctx, getCaptured } = makeCtx({ data: [] });
    await listTasks.execute({ limit: 5 }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('limit=5'), `URL: ${url}`);
  });

  it('shows deadline when present', async () => {
    const { ctx } = makeCtx({
      data: [{ id: { task_id: 'task-d' }, is_completed: false, content_plaintext: 'Deadline task', deadline_at: '2024-06-01T00:00:00Z' }]
    });
    const result = await listTasks.execute({}, ctx);
    assert.ok(result.includes('due:'));
  });

  it('handles task with no description', async () => {
    const { ctx } = makeCtx({
      data: [{ id: { task_id: 'task-no-desc' }, is_completed: false, content_plaintext: null, deadline_at: null }]
    });
    const result = await listTasks.execute({}, ctx);
    assert.ok(result.includes('No description'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => listTasks.execute({}, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: move_deal
// ---------------------------------------------------------------------------

describe('move_deal', () => {
  it('happy path — moves deal to new stage', async () => {
    const { ctx, getCaptured } = makeCtx({
      data: { id: { record_id: 'deal-abc' } }
    });
    const result = await moveDeal.execute({ recordId: 'deal-abc', stage: 'Closed Won' }, ctx);
    assert.ok(result.includes('Closed Won'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/deals/records/deal-abc'), `URL: ${url}`);
    assert.equal(opts.method, 'PATCH');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.stage, [{ status: 'Closed Won' }]);
  });

  it('uses correct record ID in URL', async () => {
    const { ctx, getCaptured } = makeCtx({ data: {} });
    await moveDeal.execute({ recordId: 'my-deal-999', stage: 'Proposal' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('my-deal-999'), `URL: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 404 });
    await assert.rejects(() => moveDeal.execute({ recordId: 'bad', stage: 'Stage' }, ctx), /404/);
  });
});

// ---------------------------------------------------------------------------
// Tool: update_record
// ---------------------------------------------------------------------------

describe('update_record', () => {
  it('happy path — updates person record fields', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'rec-abc' } } });
    const values = { job_title: [{ value: 'CEO' }] };
    const result = await updateRecord.execute({
      objectType: 'people',
      recordId: 'rec-abc',
      values
    }, ctx);
    assert.ok(result.includes('people'));
    assert.ok(result.includes('rec-abc'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/people/records/rec-abc'), `URL: ${url}`);
    assert.equal(opts.method, 'PATCH');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values, values);
  });

  it('happy path — updates company record fields', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'co-abc' } } });
    const values = { name: [{ value: 'New Name Corp' }] };
    await updateRecord.execute({
      objectType: 'companies',
      recordId: 'co-abc',
      values
    }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/objects/companies/records/co-abc'), `URL: ${url}`);
  });

  it('happy path — updates deal record fields', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-abc' } } });
    await updateRecord.execute({
      objectType: 'deals',
      recordId: 'deal-abc',
      values: { stage: [{ status: 'Won' }] }
    }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/objects/deals/records/deal-abc'), `URL: ${url}`);
  });

  it('returns confirmation message with objectType and recordId', async () => {
    const { ctx } = makeCtx({ data: {} });
    const result = await updateRecord.execute({
      objectType: 'people',
      recordId: 'test-id',
      values: {}
    }, ctx);
    assert.ok(result.includes('people'));
    assert.ok(result.includes('test-id'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 422 });
    await assert.rejects(() => updateRecord.execute({
      objectType: 'people', recordId: 'r', values: {}
    }, ctx), /422/);
  });
});

// ---------------------------------------------------------------------------
// Tool: create_deal
// ---------------------------------------------------------------------------

describe('create_deal', () => {
  it('happy path — creates deal with name only', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-new' } } });
    const result = await createDeal.execute({ name: 'New Deal' }, ctx);
    assert.ok(result.includes('New Deal'));
    assert.ok(result.includes('deal-new'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/deals/records'), `URL: ${url}`);
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.name, [{ value: 'New Deal' }]);
  });

  it('includes stage when provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-new' } } });
    await createDeal.execute({ name: 'Deal', stage: 'Qualified' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.stage, [{ status: 'Qualified' }]);
  });

  it('includes value when provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-new' } } });
    await createDeal.execute({ name: 'Deal', value: 75000 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.value, [{ currency_value: 75000 }]);
  });

  it('includes associated_company when linkedCompanyId provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-new' } } });
    await createDeal.execute({ name: 'Deal', linkedCompanyId: 'co-abc' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.data.values.associated_company, [{ target_object: 'companies', target_record_id: 'co-abc' }]);
  });

  it('omits optional fields when not provided', async () => {
    const { ctx, getCaptured } = makeCtx({ data: { id: { record_id: 'deal-new' } } });
    await createDeal.execute({ name: 'Minimal Deal' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.data.values.stage, undefined);
    assert.equal(body.data.values.value, undefined);
    assert.equal(body.data.values.associated_company, undefined);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 422 });
    await assert.rejects(() => createDeal.execute({ name: 'Bad Deal' }, ctx), /422/);
  });
});

// ---------------------------------------------------------------------------
// Tool: delete_deal
// ---------------------------------------------------------------------------

describe('delete_deal', () => {
  it('happy path — deletes deal by record ID', async () => {
    const { ctx, getCaptured } = makeCtx({});
    const result = await deleteDeal.execute({ recordId: 'deal-xyz' }, ctx);
    assert.ok(result.includes('deal-xyz'));
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/objects/deals/records/deal-xyz'), `URL: ${url}`);
    assert.equal(opts.method, 'DELETE');
  });

  it('uses correct record ID in URL', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await deleteDeal.execute({ recordId: 'deal-999' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('deal-999'), `URL: ${url}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 404 });
    await assert.rejects(() => deleteDeal.execute({ recordId: 'gone' }, ctx), /404/);
  });
});
