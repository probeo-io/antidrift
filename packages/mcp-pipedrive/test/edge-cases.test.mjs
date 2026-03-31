import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'pipedrive.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

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
// Pagination — limit param
// ---------------------------------------------------------------------------
describe('pipedrive pagination defaults', () => {
  it('pipedrive_list_deals uses default limit of 20', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('pipedrive_list_deals respects custom limit', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({ limit: 5 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=5'));
  });

  it('pipedrive_list_persons uses default limit of 20', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_persons').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('pipedrive_list_organizations uses default limit of 20', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_organizations').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('pipedrive_search_deals uses default limit of 20', async () => {
    mockFetch(200, { data: { items: [] } });
    await getTool('pipedrive_search_deals').handler({ query: 'test' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('pipedrive_list_activities uses default limit of 20', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_activities').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted from request
// ---------------------------------------------------------------------------
describe('pipedrive optional params omitted', () => {
  it('pipedrive_list_deals defaults status to open', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('status=open'));
  });

  it('pipedrive_list_deals uses custom status when provided', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({ status: 'won' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('status=won'));
  });

  it('pipedrive_list_activities omits type filter when not provided', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_activities').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(!url.includes('type='));
  });

  it('pipedrive_list_activities includes type when provided', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_activities').handler({ type: 'call' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('type=call'));
  });

  it('pipedrive_list_activities omits done filter when not provided', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_activities').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(!url.includes('done='));
  });

  it('pipedrive_list_activities includes done=0 when provided', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_activities').handler({ done: 0 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('done=0'));
  });

  it('pipedrive_create_deal only sends title when no optionals', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'Simple', id: 1 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_create_deal').handler({ title: 'Simple' });
    assert.equal(capturedBody.title, 'Simple');
    assert.equal(capturedBody.value, undefined);
    assert.equal(capturedBody.currency, undefined);
    assert.equal(capturedBody.person_id, undefined);
    assert.equal(capturedBody.org_id, undefined);
  });

  it('pipedrive_create_person only sends name when no optionals', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { name: 'Bob', id: 2 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_create_person').handler({ name: 'Bob' });
    assert.equal(capturedBody.name, 'Bob');
    assert.equal(capturedBody.email, undefined);
    assert.equal(capturedBody.phone, undefined);
    assert.equal(capturedBody.org_id, undefined);
  });

  it('pipedrive_add_note only sends content when no entity IDs', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { id: 3 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_add_note').handler({ content: 'Just a note' });
    assert.equal(capturedBody.content, 'Just a note');
    assert.equal(capturedBody.deal_id, undefined);
    assert.equal(capturedBody.person_id, undefined);
    assert.equal(capturedBody.org_id, undefined);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('pipedrive error responses', () => {
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

  it('throws on 404 not found', async () => {
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

  it('throws on 429 rate limited', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 429,
      text: async () => 'Too Many Requests',
      json: async () => ({ success: false }),
    }));
    await assert.rejects(
      () => getTool('pipedrive_list_persons').handler({}),
      (err) => {
        assert.ok(err.message.includes('Pipedrive API 429'));
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
      () => getTool('pipedrive_list_organizations').handler({}),
      (err) => {
        assert.ok(err.message.includes('Pipedrive API 500'));
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Empty result sets
// ---------------------------------------------------------------------------
describe('pipedrive empty results', () => {
  it('pipedrive_list_deals returns message on empty data', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_deals').handler({});
    assert.equal(result, 'No deals found.');
  });

  it('pipedrive_list_deals returns message on null data', async () => {
    mockFetch(200, { data: null });
    const result = await getTool('pipedrive_list_deals').handler({});
    assert.equal(result, 'No deals found.');
  });

  it('pipedrive_search_deals returns message on empty items', async () => {
    mockFetch(200, { data: { items: [] } });
    const result = await getTool('pipedrive_search_deals').handler({ query: 'ghost' });
    assert.ok(result.includes('No deals matching'));
  });

  it('pipedrive_search_deals returns message on null items', async () => {
    mockFetch(200, { data: { items: null } });
    const result = await getTool('pipedrive_search_deals').handler({ query: 'ghost' });
    assert.ok(result.includes('No deals matching'));
  });

  it('pipedrive_list_persons returns message on empty data', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_persons').handler({});
    assert.equal(result, 'No contacts found.');
  });

  it('pipedrive_search_persons returns message on empty items', async () => {
    mockFetch(200, { data: { items: [] } });
    const result = await getTool('pipedrive_search_persons').handler({ query: 'nobody' });
    assert.ok(result.includes('No contacts matching'));
  });

  it('pipedrive_list_organizations returns message on empty data', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_organizations').handler({});
    assert.equal(result, 'No organizations found.');
  });

  it('pipedrive_list_activities returns message on empty data', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_activities').handler({});
    assert.equal(result, 'No activities found.');
  });

  it('pipedrive_list_pipelines returns message on empty data', async () => {
    mockFetch(200, { data: [] });
    const result = await getTool('pipedrive_list_pipelines').handler({});
    assert.equal(result, 'No pipelines found.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in input strings
// ---------------------------------------------------------------------------
describe('pipedrive special characters in inputs', () => {
  it('pipedrive_search_deals URL-encodes query with special chars', async () => {
    mockFetch(200, { data: { items: [] } });
    await getTool('pipedrive_search_deals').handler({ query: 'deal & co <test>' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('term=deal+%26+co+%3Ctest%3E') || url.includes('term=deal%20%26%20co%20%3Ctest%3E'));
  });

  it('pipedrive_search_persons URL-encodes query with special chars', async () => {
    mockFetch(200, { data: { items: [] } });
    await getTool('pipedrive_search_persons').handler({ query: 'O\'Brien & "Smith"' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    // encodeURIComponent produces %27 for ', %26 for &, %22 for "
    assert.ok(url.includes('term='));
    assert.ok(url.includes('%26'));
  });

  it('pipedrive_create_deal passes special chars in title via body', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'Deal <"special">', id: 1 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_create_deal').handler({ title: 'Deal <"special">' });
    assert.equal(capturedBody.title, 'Deal <"special">');
  });

  it('pipedrive_add_note passes HTML content correctly', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { id: 1 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_add_note').handler({ content: '<b>Bold</b> & "quoted" <script>alert(1)</script>' });
    assert.equal(capturedBody.content, '<b>Bold</b> & "quoted" <script>alert(1)</script>');
  });
});

// ---------------------------------------------------------------------------
// URL encoding of path parameters
// ---------------------------------------------------------------------------
describe('pipedrive URL encoding', () => {
  it('pipedrive_get_deal includes deal ID in URL path', async () => {
    mockFetch(200, {
      data: {
        title: 'Test', status: 'open', add_time: '2026-01-01', id: 42,
      }
    });
    await getTool('pipedrive_get_deal').handler({ id: 42 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/deals/42'));
  });

  it('pipedrive_get_person includes person ID in URL path', async () => {
    mockFetch(200, {
      data: { name: 'Test', open_deals_count: 0, id: 10 }
    });
    await getTool('pipedrive_get_person').handler({ id: 10 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/persons/10'));
  });

  it('pipedrive_update_deal includes deal ID in URL path and uses PUT', async () => {
    let capturedOpts;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedOpts = opts;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'Updated', id: 7 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_update_deal').handler({ id: 7, title: 'Updated' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/deals/7'));
    assert.equal(capturedOpts.method, 'PUT');
  });
});

// ---------------------------------------------------------------------------
// Complex input schemas
// ---------------------------------------------------------------------------
describe('pipedrive complex inputs', () => {
  it('pipedrive_create_person sends email and phone as arrays', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { name: 'Full Person', id: 1 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_create_person').handler({
      name: 'Full Person', email: 'a@b.com', phone: '555-0000', orgId: 5,
    });
    assert.deepEqual(capturedBody.email, [{ value: 'a@b.com', primary: true }]);
    assert.deepEqual(capturedBody.phone, [{ value: '555-0000', primary: true }]);
    assert.equal(capturedBody.org_id, 5);
  });

  it('pipedrive_create_deal sends all optional params', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'Full Deal', id: 2 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_create_deal').handler({
      title: 'Full Deal', value: 5000, currency: 'EUR', personId: 10, orgId: 20,
    });
    assert.equal(capturedBody.title, 'Full Deal');
    assert.equal(capturedBody.value, 5000);
    assert.equal(capturedBody.currency, 'EUR');
    assert.equal(capturedBody.person_id, 10);
    assert.equal(capturedBody.org_id, 20);
  });

  it('pipedrive_create_activity sends all optional params', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { id: 3 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_create_activity').handler({
      subject: 'Call client', type: 'call', dueDate: '2026-04-01', dealId: 1, personId: 2,
    });
    assert.equal(capturedBody.subject, 'Call client');
    assert.equal(capturedBody.type, 'call');
    assert.equal(capturedBody.due_date, '2026-04-01');
    assert.equal(capturedBody.deal_id, 1);
    assert.equal(capturedBody.person_id, 2);
  });

  it('pipedrive_add_note attaches to multiple entities', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { id: 4 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_add_note').handler({
      content: 'Multi attach', dealId: 1, personId: 2, orgId: 3,
    });
    assert.equal(capturedBody.deal_id, 1);
    assert.equal(capturedBody.person_id, 2);
    assert.equal(capturedBody.org_id, 3);
  });

  it('pipedrive_update_deal sends all optional update fields', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { title: 'Changed', id: 5 } }),
        text: async () => '{}',
      };
    });
    await getTool('pipedrive_update_deal').handler({
      id: 5, title: 'Changed', value: 9000, status: 'won', stageId: 3,
    });
    assert.equal(capturedBody.title, 'Changed');
    assert.equal(capturedBody.value, 9000);
    assert.equal(capturedBody.status, 'won');
    assert.equal(capturedBody.stage_id, 3);
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
describe('pipedrive default values', () => {
  it('pipedrive_list_deals defaults status to open', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('status=open'));
  });

  it('pipedrive_list_deals defaults limit to 20', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('limit=20'));
  });

  it('api_token is always included in query string', async () => {
    mockFetch(200, { data: [] });
    await getTool('pipedrive_list_deals').handler({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('api_token=test-fake-token'));
  });
});
