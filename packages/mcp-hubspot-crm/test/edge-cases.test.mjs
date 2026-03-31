import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'hubspot.json');
const BACKUP_PATH = CONFIG_PATH + '.crm-edge-test-backup';

let tools;
let toolMap;

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
// Pagination
// ---------------------------------------------------------------------------
describe('pagination handling', () => {
  it('list_contacts passes custom limit to API URL', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_contacts')({ limit: 50 });
    assert.ok(capturedUrl.includes('limit=50'));
  });

  it('list_companies passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_companies')({ limit: 5 });
    assert.ok(capturedUrl.includes('limit=5'));
  });

  it('list_deals passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_deals')({ limit: 3 });
    assert.ok(capturedUrl.includes('limit=3'));
  });

  it('list_leads passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_leads')({ limit: 100 });
    assert.ok(capturedUrl.includes('limit=100'));
  });

  it('list_contacts defaults to limit=20', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_contacts')({});
    assert.ok(capturedUrl.includes('limit=20'));
  });

  it('search passes limit to request body', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_search')({ objectType: 'contacts', query: 'test', limit: 5 });
    assert.equal(capturedBody.limit, 5);
  });

  it('list_activities respects limit on note IDs', async () => {
    const noteIds = Array.from({ length: 25 }, (_, i) => ({ toObjectId: `n${i}` }));
    let fetchedNoteCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('/associations/notes')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ results: noteIds }), json: async () => ({ results: noteIds }) };
      }
      fetchedNoteCount++;
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({ properties: { hs_note_body: 'note' } }),
        json: async () => ({ properties: { hs_note_body: 'note' } })
      };
    });
    await handler('hubspot_list_activities')({ objectType: 'contacts', objectId: '1', limit: 5 });
    assert.equal(fetchedNoteCount, 5);
  });
});

// ---------------------------------------------------------------------------
// CRUD: create with all required fields
// ---------------------------------------------------------------------------
describe('create operations with all required fields', () => {
  it('create_contact sends POST with email as minimum', async () => {
    let capturedMethod, capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedMethod = opts.method;
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '1' }), json: async () => ({ id: '1' }) };
    });
    await handler('hubspot_create_contact')({ email: 'required@test.com' });
    assert.equal(capturedMethod, 'POST');
    assert.equal(capturedBody.properties.email, 'required@test.com');
  });

  it('create_company sends POST with name as minimum', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '1' }), json: async () => ({ id: '1' }) };
    });
    await handler('hubspot_create_company')({ name: 'Required Co' });
    assert.equal(capturedBody.properties.name, 'Required Co');
  });

  it('create_deal sends POST with name as minimum', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '1' }), json: async () => ({ id: '1' }) };
    });
    await handler('hubspot_create_deal')({ name: 'Required Deal' });
    assert.equal(capturedBody.properties.dealname, 'Required Deal');
  });

  it('create_lead sends POST with email as minimum', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '1' }), json: async () => ({ id: '1' }) };
    });
    await handler('hubspot_create_lead')({ email: 'lead@test.com' });
    assert.equal(capturedBody.properties.email, 'lead@test.com');
  });
});

// ---------------------------------------------------------------------------
// CRUD: update with partial fields
// ---------------------------------------------------------------------------
describe('update operations with partial fields', () => {
  it('update_contact sends only changed properties', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    await handler('hubspot_update_contact')({ contactId: '1', properties: { phone: '555-NEW' } });
    assert.deepEqual(capturedBody.properties, { phone: '555-NEW' });
  });

  it('update_company sends only changed properties', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    await handler('hubspot_update_company')({ companyId: '2', properties: { name: 'Renamed' } });
    assert.deepEqual(capturedBody.properties, { name: 'Renamed' });
  });

  it('update_deal sends only changed properties', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    await handler('hubspot_update_deal')({ dealId: '3', properties: { dealstage: 'closedwon', amount: '99999' } });
    assert.deepEqual(capturedBody.properties, { dealstage: 'closedwon', amount: '99999' });
  });

  it('update_lead sends only changed properties', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    await handler('hubspot_update_lead')({ leadId: '4', properties: { hs_lead_status: 'QUALIFIED' } });
    assert.deepEqual(capturedBody.properties, { hs_lead_status: 'QUALIFIED' });
  });
});

// ---------------------------------------------------------------------------
// Search with different object types
// ---------------------------------------------------------------------------
describe('search across different object types', () => {
  it('search contacts includes correct properties in request', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_search')({ objectType: 'contacts', query: 'test' });
    assert.deepEqual(capturedBody.properties, ['firstname', 'lastname', 'email']);
  });

  it('search companies includes correct properties in request', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_search')({ objectType: 'companies', query: 'test' });
    assert.deepEqual(capturedBody.properties, ['name', 'domain']);
  });

  it('search deals includes correct properties in request', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_search')({ objectType: 'deals', query: 'test' });
    assert.deepEqual(capturedBody.properties, ['dealname', 'amount', 'dealstage']);
  });

  it('search unknown object type sends empty properties', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_search')({ objectType: 'tickets', query: 'test' });
    assert.deepEqual(capturedBody.properties, []);
  });
});

// ---------------------------------------------------------------------------
// Deal pipeline/stage handling
// ---------------------------------------------------------------------------
describe('deal pipeline and stage handling', () => {
  it('create deal with pipeline and stage', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'd1' }), json: async () => ({ id: 'd1' }) };
    });
    await handler('hubspot_create_deal')({ name: 'Pipelined', stage: 'qualifiedtobuy', pipeline: 'enterprise' });
    assert.equal(capturedBody.properties.dealstage, 'qualifiedtobuy');
    assert.equal(capturedBody.properties.pipeline, 'enterprise');
  });

  it('get deal displays pipeline and stage', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: 'd1', properties: { dealname: 'Test', dealstage: 'closedwon', pipeline: 'sales' } }),
      json: async () => ({ id: 'd1', properties: { dealname: 'Test', dealstage: 'closedwon', pipeline: 'sales' } })
    }));
    const result = await handler('hubspot_get_deal')({ dealId: 'd1' });
    assert.ok(result.includes('Stage: closedwon'));
    assert.ok(result.includes('Pipeline: sales'));
  });

  it('update deal stage via update_deal', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({}), json: async () => ({}) };
    });
    await handler('hubspot_update_deal')({ dealId: 'd1', properties: { dealstage: 'contractsent' } });
    assert.equal(capturedBody.properties.dealstage, 'contractsent');
  });
});

// ---------------------------------------------------------------------------
// Note associations across object types
// ---------------------------------------------------------------------------
describe('note association edge cases', () => {
  it('add_note to deals uses correct association type', async () => {
    let assocUrl, assocBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      if (url.includes('/crm/v4/objects/notes/')) {
        assocUrl = url;
        assocBody = JSON.parse(opts.body);
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'n1' }), json: async () => ({ id: 'n1' }) };
    });
    await handler('hubspot_add_note')({ objectType: 'deals', objectId: 'd1', body: 'deal note' });
    assert.ok(assocUrl.includes('/associations/deals/d1'));
    assert.equal(assocBody[0].associationTypeId, 214);
  });

  it('add_note sets hs_timestamp on created note', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      if (url.includes('/crm/v3/objects/notes') && !url.includes('/associations')) {
        capturedBody = JSON.parse(opts.body);
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'n1' }), json: async () => ({ id: 'n1' }) };
    });
    await handler('hubspot_add_note')({ objectType: 'contacts', objectId: '1', body: 'test' });
    assert.ok(capturedBody.properties.hs_timestamp, 'hs_timestamp should be set');
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------
describe('empty results handling', () => {
  it('list_contacts with null results', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: null }),
      json: async () => ({ results: null })
    }));
    const result = await handler('hubspot_list_contacts')({});
    assert.equal(result, 'No contacts found.');
  });

  it('list_companies with undefined results', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({}),
      json: async () => ({})
    }));
    const result = await handler('hubspot_list_companies')({});
    assert.equal(result, 'No companies found.');
  });

  it('list_deals with empty results array', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_list_deals')({});
    assert.equal(result, 'No deals found.');
  });

  it('list_forecasts with empty results', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_list_forecasts')({});
    assert.equal(result, 'No forecasts found.');
  });

  it('list_line_items with empty results', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_list_line_items')({});
    assert.equal(result, 'No line items found.');
  });
});

// ---------------------------------------------------------------------------
// Contact/Company formatting edge cases
// ---------------------------------------------------------------------------
describe('formatting edge cases', () => {
  it('contact with no name shows Unknown', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: '1', properties: { email: 'noname@test.com' } }] }),
      json: async () => ({ results: [{ id: '1', properties: { email: 'noname@test.com' } }] })
    }));
    const result = await handler('hubspot_list_contacts')({});
    assert.ok(result.includes('Unknown'));
    assert.ok(result.includes('noname@test.com'));
  });

  it('company with no domain omits domain field', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: '1', properties: { name: 'NoDomain' } }] }),
      json: async () => ({ results: [{ id: '1', properties: { name: 'NoDomain' } }] })
    }));
    const result = await handler('hubspot_list_companies')({});
    assert.ok(result.includes('NoDomain'));
    assert.ok(!result.includes('\u2014'));
  });

  it('deal with no amount omits dollar sign', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: '1', properties: { dealname: 'NoMoney' } }] }),
      json: async () => ({ results: [{ id: '1', properties: { dealname: 'NoMoney' } }] })
    }));
    const result = await handler('hubspot_list_deals')({});
    assert.ok(result.includes('NoMoney'));
    assert.ok(!result.includes('$'));
  });

  it('line item with only name shows Unknown-like output', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: 'li1', properties: { name: 'Solo' } }] }),
      json: async () => ({ results: [{ id: 'li1', properties: { name: 'Solo' } }] })
    }));
    const result = await handler('hubspot_list_line_items')({});
    assert.ok(result.includes('Solo'));
    assert.ok(!result.includes('\u00d7'));
    assert.ok(!result.includes('$'));
  });

  it('activities strips HTML from note body', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('/associations/notes')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ results: [{ toObjectId: 'n1' }] }), json: async () => ({ results: [{ toObjectId: 'n1' }] }) };
      }
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({ properties: { hs_note_body: '<p>Hello <strong>world</strong></p>' } }),
        json: async () => ({ properties: { hs_note_body: '<p>Hello <strong>world</strong></p>' } })
      };
    });
    const result = await handler('hubspot_list_activities')({ objectType: 'contacts', objectId: '1' });
    assert.ok(result.includes('Hello world'));
    assert.ok(!result.includes('<p>'));
    assert.ok(!result.includes('<strong>'));
  });

  it('activities truncates long note body to 200 chars', async () => {
    const longBody = 'A'.repeat(300);
    mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('/associations/notes')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ results: [{ toObjectId: 'n1' }] }), json: async () => ({ results: [{ toObjectId: 'n1' }] }) };
      }
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({ properties: { hs_note_body: longBody } }),
        json: async () => ({ properties: { hs_note_body: longBody } })
      };
    });
    const result = await handler('hubspot_list_activities')({ objectType: 'contacts', objectId: '1' });
    // The note body is substring(0, 200), so there should not be 300 A's in the output
    const aCount = (result.match(/A/g) || []).length;
    assert.equal(aCount, 200, `Expected 200 A's in truncated body, got ${aCount}`);
  });
});

// ---------------------------------------------------------------------------
// Forecast properties rendering
// ---------------------------------------------------------------------------
describe('forecast rendering', () => {
  it('skips null and empty properties', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: 'f1', properties: { period: 'Q1', amount: '', empty: null, valid: '100' } }] }),
      json: async () => ({ results: [{ id: 'f1', properties: { period: 'Q1', amount: '', empty: null, valid: '100' } }] })
    }));
    const result = await handler('hubspot_list_forecasts')({});
    assert.ok(result.includes('period: Q1'));
    assert.ok(result.includes('valid: 100'));
    assert.ok(!result.includes('amount:'));
    assert.ok(!result.includes('empty:'));
  });
});
