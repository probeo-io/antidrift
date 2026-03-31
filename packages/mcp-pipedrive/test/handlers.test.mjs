import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'pipedrive.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

let tools;
let toolMap;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ apiToken: 'test-fake-token', domain: 'testcompany' }));

  const mod = await import('../connectors/pipedrive.mjs');
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
// Authentication
// ---------------------------------------------------------------------------
describe('pipedrive authentication', () => {
  it('includes api_token in URL query string', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('api_token=test-fake-token'));
  });

  it('uses correct domain in base URL', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('testcompany.pipedrive.com'));
  });
});

// ---------------------------------------------------------------------------
// pipedrive_list_deals
// ---------------------------------------------------------------------------
describe('pipedrive_list_deals handler', () => {
  it('returns formatted deal list', async () => {
    mockFetch(200, {
      data: [
        { title: 'Big Deal', stage_id: 3, value: 5000, currency: 'USD', person_name: 'Alice', status: 'open', id: 1 },
      ]
    });
    const result = await getTool('pipedrive_list_deals').handler({});
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('$5000'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('(open)'));
    assert.ok(result.includes('[id: 1]'));
  });

  it('returns message when no deals', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_deals').handler({});
    assert.equal(result, 'No deals found.');
  });
});

// ---------------------------------------------------------------------------
// pipedrive_get_deal
// ---------------------------------------------------------------------------
describe('pipedrive_get_deal handler', () => {
  it('returns formatted deal details', async () => {
    mockFetch(200, {
      data: {
        title: 'Big Deal', status: 'open', value: 5000, currency: 'USD',
        person_name: 'Alice', org_name: 'Acme', pipeline_id: 1, stage_id: 3,
        expected_close_date: '2026-06-01', owner_name: 'Bob',
        add_time: '2026-01-01', id: 1,
      }
    });
    const result = await getTool('pipedrive_get_deal').handler({ id: 1 });
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('$5000'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('Acme'));
    assert.ok(result.includes('Bob'));
    assert.ok(result.includes('[id: 1]'));
  });
});

// ---------------------------------------------------------------------------
// pipedrive_create_deal
// ---------------------------------------------------------------------------
describe('pipedrive_create_deal handler', () => {
  it('creates deal and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'New Deal', id: 42 } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('pipedrive_create_deal').handler({ title: 'New Deal', value: 1000 });
    assert.ok(result.includes('Created deal'));
    assert.ok(result.includes('New Deal'));
    assert.ok(result.includes('[id: 42]'));
    assert.equal(capturedBody.title, 'New Deal');
    assert.equal(capturedBody.value, 1000);
  });
});

// ---------------------------------------------------------------------------
// pipedrive_update_deal
// ---------------------------------------------------------------------------
describe('pipedrive_update_deal handler', () => {
  it('updates deal and returns confirmation', async () => {
    let capturedOpts;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedOpts = opts;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'Updated Deal', id: 1 } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('pipedrive_update_deal').handler({ id: 1, status: 'won' });
    assert.ok(result.includes('Updated deal'));
    assert.equal(capturedOpts.method, 'PUT');
  });
});

// ---------------------------------------------------------------------------
// pipedrive_search_deals
// ---------------------------------------------------------------------------
describe('pipedrive_search_deals handler', () => {
  it('returns formatted search results', async () => {
    mockFetch(200, {
      data: { items: [
        { item: { title: 'Found Deal', status: 'open', id: 5 } }
      ] }
    });
    const result = await getTool('pipedrive_search_deals').handler({ query: 'Found' });
    assert.ok(result.includes('Found Deal'));
    assert.ok(result.includes('[id: 5]'));
  });

  it('returns message when no results', async () => {
    mockFetch(200, { data: { items: [] } });
    const result = await getTool('pipedrive_search_deals').handler({ query: 'nonexistent' });
    assert.ok(result.includes('No deals matching'));
    assert.ok(result.includes('nonexistent'));
  });
});

// ---------------------------------------------------------------------------
// pipedrive_list_persons
// ---------------------------------------------------------------------------
describe('pipedrive_list_persons handler', () => {
  it('returns formatted contact list', async () => {
    mockFetch(200, {
      data: [
        { name: 'Alice', email: [{ value: 'alice@test.com' }], phone: [{ value: '555-1234' }], org_name: 'Acme', id: 10 },
      ]
    });
    const result = await getTool('pipedrive_list_persons').handler({});
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('alice@test.com'));
    assert.ok(result.includes('555-1234'));
    assert.ok(result.includes('Acme'));
    assert.ok(result.includes('[id: 10]'));
  });

  it('returns message when no contacts', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_persons').handler({});
    assert.equal(result, 'No contacts found.');
  });
});

// ---------------------------------------------------------------------------
// pipedrive_get_person
// ---------------------------------------------------------------------------
describe('pipedrive_get_person handler', () => {
  it('returns formatted person details', async () => {
    mockFetch(200, {
      data: {
        name: 'Alice', email: [{ value: 'alice@test.com' }], phone: [{ value: '555-1234' }],
        org_name: 'Acme', owner_name: 'Bob', open_deals_count: 3, id: 10,
      }
    });
    const result = await getTool('pipedrive_get_person').handler({ id: 10 });
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('alice@test.com'));
    assert.ok(result.includes('Acme'));
    assert.ok(result.includes('Bob'));
    assert.ok(result.includes('3'));
    assert.ok(result.includes('[id: 10]'));
  });
});

// ---------------------------------------------------------------------------
// pipedrive_create_person
// ---------------------------------------------------------------------------
describe('pipedrive_create_person handler', () => {
  it('creates person and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { name: 'Charlie', id: 20 } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('pipedrive_create_person').handler({
      name: 'Charlie', email: 'charlie@test.com', phone: '555-5678'
    });
    assert.ok(result.includes('Created contact'));
    assert.ok(result.includes('Charlie'));
    assert.equal(capturedBody.name, 'Charlie');
    assert.deepEqual(capturedBody.email, [{ value: 'charlie@test.com', primary: true }]);
  });
});

// ---------------------------------------------------------------------------
// pipedrive_list_organizations
// ---------------------------------------------------------------------------
describe('pipedrive_list_organizations handler', () => {
  it('returns formatted organization list', async () => {
    mockFetch(200, {
      data: [
        { name: 'Acme Corp', address: '123 Main St', id: 30 },
      ]
    });
    const result = await getTool('pipedrive_list_organizations').handler({});
    assert.ok(result.includes('Acme Corp'));
    assert.ok(result.includes('123 Main St'));
    assert.ok(result.includes('[id: 30]'));
  });

  it('returns message when no organizations', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_organizations').handler({});
    assert.equal(result, 'No organizations found.');
  });
});

// ---------------------------------------------------------------------------
// pipedrive_list_activities
// ---------------------------------------------------------------------------
describe('pipedrive_list_activities handler', () => {
  it('returns formatted activity list', async () => {
    mockFetch(200, {
      data: [
        { done: false, type: 'call', subject: 'Follow up', due_date: '2026-04-01', person_name: 'Alice', id: 50 },
      ]
    });
    const result = await getTool('pipedrive_list_activities').handler({});
    assert.ok(result.includes('call'));
    assert.ok(result.includes('Follow up'));
    assert.ok(result.includes('2026-04-01'));
    assert.ok(result.includes('Alice'));
  });

  it('returns message when no activities', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_activities').handler({});
    assert.equal(result, 'No activities found.');
  });
});

// ---------------------------------------------------------------------------
// pipedrive_create_activity
// ---------------------------------------------------------------------------
describe('pipedrive_create_activity handler', () => {
  it('creates activity and returns confirmation', async () => {
    mockFetch(200, { data: { id: 60 } });
    const result = await getTool('pipedrive_create_activity').handler({
      subject: 'Team sync', type: 'meeting'
    });
    assert.ok(result.includes('Created meeting'));
    assert.ok(result.includes('Team sync'));
  });
});

// ---------------------------------------------------------------------------
// pipedrive_add_note
// ---------------------------------------------------------------------------
describe('pipedrive_add_note handler', () => {
  it('adds note and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { id: 70 } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('pipedrive_add_note').handler({
      content: 'Great call!', dealId: 1
    });
    assert.ok(result.includes('Note added'));
    assert.ok(result.includes('[id: 70]'));
    assert.equal(capturedBody.content, 'Great call!');
    assert.equal(capturedBody.deal_id, 1);
  });
});

// ---------------------------------------------------------------------------
// pipedrive_list_pipelines
// ---------------------------------------------------------------------------
describe('pipedrive_list_pipelines handler', () => {
  it('returns formatted pipeline list with stages', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callCount++;
      if (url.includes('/stages')) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: [{ order_nr: 1, name: 'Lead In', id: 100 }] }),
          text: async () => '{}',
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({ data: [{ name: 'Sales Pipeline', id: 1 }] }),
        text: async () => '{}',
      };
    });
    const result = await getTool('pipedrive_list_pipelines').handler({});
    assert.ok(result.includes('Sales Pipeline'));
    assert.ok(result.includes('[id: 1]'));
    assert.ok(result.includes('Lead In'));
  });

  it('returns message when no pipelines', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_pipelines').handler({});
    assert.equal(result, 'No pipelines found.');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('pipedrive error handling', () => {
  it('throws on 404 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ success: false }),
    }));
    await assert.rejects(
      () => getTool('pipedrive_get_deal').handler({ id: 999 }),
      (err) => {
        assert.ok(err.message.includes('Pipedrive API 404'));
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
      () => getTool('pipedrive_list_deals').handler({}),
      (err) => {
        assert.ok(err.message.includes('Pipedrive API 401'));
        return true;
      }
    );
  });
});
