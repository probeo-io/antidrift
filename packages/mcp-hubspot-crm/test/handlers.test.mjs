import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'hubspot.json');
const BACKUP_PATH = CONFIG_PATH + '.crm-handler-test-backup';

let tools;
let toolMap;

function fakeFetch(data, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data
  });
}

function handler(name) {
  return toolMap[name].handler;
}

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ accessToken: 'test-token' }));

  const mod = await import('../connectors/hubspot-crm.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));

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

// ---------------------------------------------------------------------------
// hubspot_list_contacts
// ---------------------------------------------------------------------------
describe('hubspot_list_contacts handler', () => {
  it('returns formatted contact list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: '101', properties: { firstname: 'Jane', lastname: 'Doe', email: 'jane@test.com' } },
        { id: '102', properties: { firstname: 'Bob', lastname: 'Smith', email: 'bob@test.com' } }
      ]
    }));
    const result = await handler('hubspot_list_contacts')({});
    assert.ok(result.includes('Jane Doe'));
    assert.ok(result.includes('jane@test.com'));
    assert.ok(result.includes('[id: 101]'));
    assert.ok(result.includes('Bob Smith'));
  });

  it('returns message when no contacts found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_contacts')({});
    assert.equal(result, 'No contacts found.');
  });

  it('uses search endpoint when query provided', async () => {
    let capturedUrl, capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({ results: [{ id: '1', properties: { firstname: 'Jane', lastname: 'Doe', email: 'j@t.com' } }] }),
        json: async () => ({ results: [{ id: '1', properties: { firstname: 'Jane', lastname: 'Doe', email: 'j@t.com' } }] })
      };
    });
    await handler('hubspot_list_contacts')({ query: 'Jane', limit: 5 });
    assert.ok(capturedUrl.includes('/crm/v3/objects/contacts/search'));
    assert.equal(capturedBody.query, 'Jane');
    assert.equal(capturedBody.limit, 5);
  });

  it('returns no-match message when search yields nothing', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_contacts')({ query: 'nobody' });
    assert.ok(result.includes('No contacts matching'));
    assert.ok(result.includes('nobody'));
  });

  it('sends Bearer token auth header', async () => {
    mock.method(globalThis, 'fetch', async (url, opts) => {
      assert.equal(opts.headers['Authorization'], 'Bearer test-token');
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_contacts')({});
  });

  it('calls correct GET URL with properties', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_contacts')({ limit: 10 });
    assert.ok(capturedUrl.includes('https://api.hubapi.com/crm/v3/objects/contacts'));
    assert.ok(capturedUrl.includes('limit=10'));
    assert.ok(capturedUrl.includes('firstname'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_contact
// ---------------------------------------------------------------------------
describe('hubspot_get_contact handler', () => {
  it('returns full contact details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: '101',
      properties: {
        firstname: 'Jane', lastname: 'Doe', email: 'jane@test.com',
        phone: '555-1234', company: 'Acme', jobtitle: 'CTO', lifecyclestage: 'customer'
      }
    }));
    const result = await handler('hubspot_get_contact')({ contactId: '101' });
    assert.ok(result.includes('Jane Doe'));
    assert.ok(result.includes('jane@test.com'));
    assert.ok(result.includes('555-1234'));
    assert.ok(result.includes('Acme'));
    assert.ok(result.includes('CTO'));
    assert.ok(result.includes('customer'));
    assert.ok(result.includes('[id: 101]'));
  });

  it('handles contact with minimal properties', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ id: '200', properties: {} }));
    const result = await handler('hubspot_get_contact')({ contactId: '200' });
    assert.ok(result.includes('Unknown'));
    assert.ok(result.includes('[id: 200]'));
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: '1', properties: {} }), json: async () => ({ id: '1', properties: {} }) };
    });
    await handler('hubspot_get_contact')({ contactId: '999' });
    assert.ok(capturedUrl.includes('/crm/v3/objects/contacts/999'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_create_contact
// ---------------------------------------------------------------------------
describe('hubspot_create_contact handler', () => {
  it('creates contact and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ id: '300' }),
        json: async () => ({ id: '300' })
      };
    });
    const result = await handler('hubspot_create_contact')({
      email: 'new@test.com', firstName: 'New', lastName: 'User', phone: '555-9999', company: 'TestCo', jobTitle: 'Dev'
    });
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('new@test.com'));
    assert.ok(result.includes('[id: 300]'));
    assert.equal(capturedBody.properties.email, 'new@test.com');
    assert.equal(capturedBody.properties.firstname, 'New');
    assert.equal(capturedBody.properties.lastname, 'User');
    assert.equal(capturedBody.properties.phone, '555-9999');
    assert.equal(capturedBody.properties.company, 'TestCo');
    assert.equal(capturedBody.properties.jobtitle, 'Dev');
  });

  it('sends only email when optional fields omitted', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '301' }), json: async () => ({ id: '301' }) };
    });
    await handler('hubspot_create_contact')({ email: 'minimal@test.com' });
    assert.equal(capturedBody.properties.email, 'minimal@test.com');
    assert.equal(capturedBody.properties.firstname, undefined);
    assert.equal(capturedBody.properties.lastname, undefined);
  });

  it('uses POST method to correct path', async () => {
    let capturedUrl, capturedMethod;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '1' }), json: async () => ({ id: '1' }) };
    });
    await handler('hubspot_create_contact')({ email: 'x@y.com' });
    assert.ok(capturedUrl.includes('/crm/v3/objects/contacts'));
    assert.equal(capturedMethod, 'POST');
  });
});

// ---------------------------------------------------------------------------
// hubspot_update_contact
// ---------------------------------------------------------------------------
describe('hubspot_update_contact handler', () => {
  it('updates contact and returns confirmation', async () => {
    let capturedUrl, capturedMethod, capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    const result = await handler('hubspot_update_contact')({ contactId: '101', properties: { firstname: 'Updated' } });
    assert.ok(result.includes('Updated contact 101'));
    assert.ok(capturedUrl.includes('/crm/v3/objects/contacts/101'));
    assert.equal(capturedMethod, 'PATCH');
    assert.deepEqual(capturedBody.properties, { firstname: 'Updated' });
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_companies
// ---------------------------------------------------------------------------
describe('hubspot_list_companies handler', () => {
  it('returns formatted company list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: '201', properties: { name: 'Acme Corp', domain: 'acme.com' } },
        { id: '202', properties: { name: 'Globex', domain: 'globex.io' } }
      ]
    }));
    const result = await handler('hubspot_list_companies')({});
    assert.ok(result.includes('Acme Corp'));
    assert.ok(result.includes('acme.com'));
    assert.ok(result.includes('[id: 201]'));
    assert.ok(result.includes('Globex'));
  });

  it('returns message when no companies found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_companies')({});
    assert.equal(result, 'No companies found.');
  });

  it('uses search endpoint when query provided', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_companies')({ query: 'Acme' });
    assert.ok(capturedUrl.includes('/crm/v3/objects/companies/search'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_company
// ---------------------------------------------------------------------------
describe('hubspot_get_company handler', () => {
  it('returns full company details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: '201',
      properties: {
        name: 'Acme Corp', domain: 'acme.com', industry: 'Technology',
        numberofemployees: '500', annualrevenue: '10000000'
      }
    }));
    const result = await handler('hubspot_get_company')({ companyId: '201' });
    assert.ok(result.includes('Acme Corp'));
    assert.ok(result.includes('acme.com'));
    assert.ok(result.includes('Technology'));
    assert.ok(result.includes('500 employees'));
    assert.ok(result.includes('$10000000'));
    assert.ok(result.includes('[id: 201]'));
  });

  it('handles company with minimal properties', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ id: '999', properties: {} }));
    const result = await handler('hubspot_get_company')({ companyId: '999' });
    assert.ok(result.includes('Unknown'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_create_company
// ---------------------------------------------------------------------------
describe('hubspot_create_company handler', () => {
  it('creates company and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '500' }), json: async () => ({ id: '500' }) };
    });
    const result = await handler('hubspot_create_company')({ name: 'NewCo', domain: 'newco.com', industry: 'SaaS' });
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('NewCo'));
    assert.ok(result.includes('[id: 500]'));
    assert.equal(capturedBody.properties.name, 'NewCo');
    assert.equal(capturedBody.properties.domain, 'newco.com');
    assert.equal(capturedBody.properties.industry, 'SaaS');
  });

  it('sends only name when optional fields omitted', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '501' }), json: async () => ({ id: '501' }) };
    });
    await handler('hubspot_create_company')({ name: 'MinimalCo' });
    assert.equal(capturedBody.properties.name, 'MinimalCo');
    assert.equal(capturedBody.properties.domain, undefined);
    assert.equal(capturedBody.properties.industry, undefined);
  });
});

// ---------------------------------------------------------------------------
// hubspot_update_company
// ---------------------------------------------------------------------------
describe('hubspot_update_company handler', () => {
  it('updates company and returns confirmation', async () => {
    let capturedUrl, capturedMethod;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    const result = await handler('hubspot_update_company')({ companyId: '201', properties: { industry: 'Finance' } });
    assert.ok(result.includes('Updated company 201'));
    assert.ok(capturedUrl.includes('/crm/v3/objects/companies/201'));
    assert.equal(capturedMethod, 'PATCH');
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_deals
// ---------------------------------------------------------------------------
describe('hubspot_list_deals handler', () => {
  it('returns formatted deal list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: '301', properties: { dealname: 'Big Deal', dealstage: 'closedwon', amount: '50000' } },
        { id: '302', properties: { dealname: 'Small Deal', dealstage: 'proposal', amount: '5000' } }
      ]
    }));
    const result = await handler('hubspot_list_deals')({});
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('closedwon'));
    assert.ok(result.includes('$50000'));
    assert.ok(result.includes('[id: 301]'));
    assert.ok(result.includes('Small Deal'));
  });

  it('returns message when no deals found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_deals')({});
    assert.equal(result, 'No deals found.');
  });

  it('uses search endpoint when query provided', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_deals')({ query: 'Big' });
    assert.ok(capturedUrl.includes('/crm/v3/objects/deals/search'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_deal
// ---------------------------------------------------------------------------
describe('hubspot_get_deal handler', () => {
  it('returns full deal details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: '301',
      properties: {
        dealname: 'Big Deal', dealstage: 'closedwon', pipeline: 'default',
        amount: '50000', closedate: '2026-06-01'
      }
    }));
    const result = await handler('hubspot_get_deal')({ dealId: '301' });
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('closedwon'));
    assert.ok(result.includes('default'));
    assert.ok(result.includes('$50000'));
    assert.ok(result.includes('2026-06-01'));
    assert.ok(result.includes('[id: 301]'));
  });

  it('handles deal with minimal properties', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ id: '999', properties: {} }));
    const result = await handler('hubspot_get_deal')({ dealId: '999' });
    assert.ok(result.includes('Unknown'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_create_deal
// ---------------------------------------------------------------------------
describe('hubspot_create_deal handler', () => {
  it('creates deal with all fields and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '600' }), json: async () => ({ id: '600' }) };
    });
    const result = await handler('hubspot_create_deal')({
      name: 'Enterprise Deal', amount: '100000', stage: 'proposal', pipeline: 'sales', closeDate: '2026-12-31'
    });
    assert.ok(result.includes('Created deal'));
    assert.ok(result.includes('Enterprise Deal'));
    assert.ok(result.includes('[id: 600]'));
    assert.equal(capturedBody.properties.dealname, 'Enterprise Deal');
    assert.equal(capturedBody.properties.amount, '100000');
    assert.equal(capturedBody.properties.dealstage, 'proposal');
    assert.equal(capturedBody.properties.pipeline, 'sales');
    assert.equal(capturedBody.properties.closedate, '2026-12-31');
  });

  it('sends only dealname when optional fields omitted', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '601' }), json: async () => ({ id: '601' }) };
    });
    await handler('hubspot_create_deal')({ name: 'Simple Deal' });
    assert.equal(capturedBody.properties.dealname, 'Simple Deal');
    assert.equal(capturedBody.properties.amount, undefined);
    assert.equal(capturedBody.properties.dealstage, undefined);
  });
});

// ---------------------------------------------------------------------------
// hubspot_update_deal
// ---------------------------------------------------------------------------
describe('hubspot_update_deal handler', () => {
  it('updates deal and returns confirmation', async () => {
    let capturedUrl, capturedMethod;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    const result = await handler('hubspot_update_deal')({ dealId: '301', properties: { amount: '75000' } });
    assert.ok(result.includes('Updated deal 301'));
    assert.ok(capturedUrl.includes('/crm/v3/objects/deals/301'));
    assert.equal(capturedMethod, 'PATCH');
  });
});

// ---------------------------------------------------------------------------
// hubspot_add_note
// ---------------------------------------------------------------------------
describe('hubspot_add_note handler', () => {
  it('creates note and associates with contact', async () => {
    let calls = [];
    mock.method(globalThis, 'fetch', async (url, opts) => {
      calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined });
      if (url.includes('/crm/v3/objects/notes')) {
        return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'note-1' }), json: async () => ({ id: 'note-1' }) };
      }
      // Association PUT
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    const result = await handler('hubspot_add_note')({ objectType: 'contacts', objectId: '101', body: 'Follow up call' });
    assert.ok(result.includes('Note added'));
    assert.ok(result.includes('contacts'));
    assert.ok(result.includes('101'));
    assert.ok(result.includes('[note id: note-1]'));
    // First call creates the note
    assert.equal(calls[0].method, 'POST');
    assert.ok(calls[0].url.includes('/crm/v3/objects/notes'));
    assert.equal(calls[0].body.properties.hs_note_body, 'Follow up call');
    // Second call associates
    assert.equal(calls[1].method, 'PUT');
    assert.ok(calls[1].url.includes('/crm/v4/objects/notes/note-1/associations/contacts/101'));
  });

  it('uses correct association type IDs', async () => {
    const typeIds = { contacts: 202, companies: 190, deals: 214 };
    for (const [objType, expectedId] of Object.entries(typeIds)) {
      let assocBody;
      mock.method(globalThis, 'fetch', async (url, opts) => {
        if (url.includes('/crm/v4/objects/notes/')) {
          assocBody = JSON.parse(opts.body);
        }
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'n1' }), json: async () => ({ id: 'n1' }) };
      });
      await handler('hubspot_add_note')({ objectType: objType, objectId: '1', body: 'test' });
      assert.equal(assocBody[0].associationTypeId, expectedId, `Wrong associationTypeId for ${objType}`);
      mock.restoreAll();
    }
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_activities
// ---------------------------------------------------------------------------
describe('hubspot_list_activities handler', () => {
  it('returns formatted activities', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callCount++;
      if (url.includes('/associations/notes')) {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ results: [{ toObjectId: 'n1' }, { toObjectId: 'n2' }] }),
          json: async () => ({ results: [{ toObjectId: 'n1' }, { toObjectId: 'n2' }] })
        };
      }
      // Individual note fetch
      const noteData = {
        properties: {
          hs_note_body: 'Called to discuss renewal',
          hs_timestamp: '2026-03-01T10:00:00Z'
        }
      };
      return { ok: true, status: 200, text: async () => JSON.stringify(noteData), json: async () => noteData };
    });
    const result = await handler('hubspot_list_activities')({ objectType: 'contacts', objectId: '101' });
    assert.ok(result.includes('Called to discuss renewal'));
    assert.ok(result.includes('[note id: n1]'));
    assert.ok(result.includes('[note id: n2]'));
  });

  it('returns message when no notes found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_activities')({ objectType: 'contacts', objectId: '101' });
    assert.ok(result.includes('No notes found'));
  });

  it('handles note fetch failure gracefully', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('/associations/notes')) {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ results: [{ toObjectId: 'n-broken' }] }),
          json: async () => ({ results: [{ toObjectId: 'n-broken' }] })
        };
      }
      // Fail on individual note
      return { ok: false, status: 404, text: async () => 'Not Found', json: async () => ({}) };
    });
    const result = await handler('hubspot_list_activities')({ objectType: 'contacts', objectId: '101' });
    assert.ok(result.includes('could not load'));
    assert.ok(result.includes('[note id: n-broken]'));
  });

  it('calls correct associations API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      if (!capturedUrl) capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_activities')({ objectType: 'deals', objectId: '301' });
    assert.ok(capturedUrl.includes('/crm/v4/objects/deals/301/associations/notes'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_search
// ---------------------------------------------------------------------------
describe('hubspot_search handler', () => {
  it('searches contacts and returns formatted results', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{ id: '10', properties: { firstname: 'Alice', lastname: 'W', email: 'alice@test.com' } }]
    }));
    const result = await handler('hubspot_search')({ objectType: 'contacts', query: 'Alice' });
    assert.ok(result.includes('Alice W'));
    assert.ok(result.includes('alice@test.com'));
  });

  it('searches companies and returns formatted results', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{ id: '20', properties: { name: 'Acme', domain: 'acme.com' } }]
    }));
    const result = await handler('hubspot_search')({ objectType: 'companies', query: 'Acme' });
    assert.ok(result.includes('Acme'));
    assert.ok(result.includes('acme.com'));
  });

  it('searches deals and returns formatted results', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{ id: '30', properties: { dealname: 'Big Deal', dealstage: 'closedwon', amount: '99000' } }]
    }));
    const result = await handler('hubspot_search')({ objectType: 'deals', query: 'Big' });
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('$99000'));
  });

  it('returns no-match message when no results', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_search')({ objectType: 'contacts', query: 'zzz' });
    assert.ok(result.includes('No contacts matching'));
    assert.ok(result.includes('zzz'));
  });

  it('uses correct search path for object type', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_search')({ objectType: 'companies', query: 'test' });
    assert.ok(capturedUrl.includes('/crm/v3/objects/companies/search'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_leads
// ---------------------------------------------------------------------------
describe('hubspot_list_leads handler', () => {
  it('returns formatted lead list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: '401', properties: { firstname: 'Lead', lastname: 'One', email: 'lead@test.com' } }
      ]
    }));
    const result = await handler('hubspot_list_leads')({});
    assert.ok(result.includes('Lead One'));
    assert.ok(result.includes('lead@test.com'));
    assert.ok(result.includes('[id: 401]'));
  });

  it('returns message when no leads found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_leads')({});
    assert.equal(result, 'No leads found.');
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_lead
// ---------------------------------------------------------------------------
describe('hubspot_get_lead handler', () => {
  it('returns full lead details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: '401',
      properties: {
        firstname: 'Lead', lastname: 'One', email: 'lead@test.com',
        phone: '555-0000', company: 'LeadCo', lifecyclestage: 'lead', hs_lead_status: 'OPEN'
      }
    }));
    const result = await handler('hubspot_get_lead')({ leadId: '401' });
    assert.ok(result.includes('Lead One'));
    assert.ok(result.includes('lead@test.com'));
    assert.ok(result.includes('555-0000'));
    assert.ok(result.includes('LeadCo'));
    assert.ok(result.includes('lead'));
    assert.ok(result.includes('OPEN'));
    assert.ok(result.includes('[id: 401]'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_create_lead
// ---------------------------------------------------------------------------
describe('hubspot_create_lead handler', () => {
  it('creates lead and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '700' }), json: async () => ({ id: '700' }) };
    });
    const result = await handler('hubspot_create_lead')({
      email: 'newlead@test.com', firstName: 'New', lastName: 'Lead'
    });
    assert.ok(result.includes('Created lead'));
    assert.ok(result.includes('newlead@test.com'));
    assert.ok(result.includes('[id: 700]'));
    assert.equal(capturedBody.properties.email, 'newlead@test.com');
    assert.equal(capturedBody.properties.firstname, 'New');
  });

  it('uses correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '1' }), json: async () => ({ id: '1' }) };
    });
    await handler('hubspot_create_lead')({ email: 'x@y.com' });
    assert.ok(capturedUrl.includes('/crm/v3/objects/leads'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_update_lead
// ---------------------------------------------------------------------------
describe('hubspot_update_lead handler', () => {
  it('updates lead and returns confirmation', async () => {
    let capturedUrl, capturedMethod;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    const result = await handler('hubspot_update_lead')({ leadId: '401', properties: { hs_lead_status: 'QUALIFIED' } });
    assert.ok(result.includes('Updated lead 401'));
    assert.ok(capturedUrl.includes('/crm/v3/objects/leads/401'));
    assert.equal(capturedMethod, 'PATCH');
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_forecasts
// ---------------------------------------------------------------------------
describe('hubspot_list_forecasts handler', () => {
  it('returns formatted forecasts', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: 'f1', properties: { period: 'Q1 2026', amount: '500000' } }
      ]
    }));
    const result = await handler('hubspot_list_forecasts')({});
    assert.ok(result.includes('Forecast [id: f1]'));
    assert.ok(result.includes('period: Q1 2026'));
    assert.ok(result.includes('amount: 500000'));
  });

  it('returns message when no forecasts found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_forecasts')({});
    assert.equal(result, 'No forecasts found.');
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_line_items
// ---------------------------------------------------------------------------
describe('hubspot_list_line_items handler', () => {
  it('returns formatted line items', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: 'li1', properties: { name: 'Widget', quantity: '10', price: '25', amount: '250' } }
      ]
    }));
    const result = await handler('hubspot_list_line_items')({});
    assert.ok(result.includes('Widget'));
    assert.ok(result.includes('\u00d710'));
    assert.ok(result.includes('$25'));
    assert.ok(result.includes('$250'));
    assert.ok(result.includes('[id: li1]'));
  });

  it('returns message when no line items found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_line_items')({});
    assert.equal(result, 'No line items found.');
  });

  it('handles line item with minimal properties', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{ id: 'li2', properties: {} }]
    }));
    const result = await handler('hubspot_list_line_items')({});
    assert.ok(result.includes('Unknown'));
    assert.ok(result.includes('[id: li2]'));
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('hubspot-crm error handling', () => {
  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({ message: 'Unauthorized' })
    }));
    await assert.rejects(
      () => handler('hubspot_list_contacts')({}),
      (err) => { assert.ok(err.message.includes('HubSpot API 401')); return true; }
    );
  });

  it('throws on 404 not found', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ message: 'Not Found' })
    }));
    await assert.rejects(
      () => handler('hubspot_get_contact')({ contactId: '999' }),
      (err) => { assert.ok(err.message.includes('HubSpot API 404')); return true; }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ message: 'Internal Server Error' })
    }));
    await assert.rejects(
      () => handler('hubspot_list_deals')({}),
      (err) => { assert.ok(err.message.includes('HubSpot API 500')); return true; }
    );
  });

  it('error on get_company includes status code', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 403,
      text: async () => 'Forbidden',
      json: async () => ({ message: 'Forbidden' })
    }));
    await assert.rejects(
      () => handler('hubspot_get_company')({ companyId: '1' }),
      (err) => { assert.ok(err.message.includes('HubSpot API 403')); return true; }
    );
  });

  it('error on create_deal includes status code', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 429,
      text: async () => 'Rate limit exceeded',
      json: async () => ({})
    }));
    await assert.rejects(
      () => handler('hubspot_create_deal')({ name: 'test' }),
      (err) => { assert.ok(err.message.includes('HubSpot API 429')); return true; }
    );
  });
});
