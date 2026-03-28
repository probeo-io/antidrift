import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'notion.json');
const BACKUP_PATH = CONFIG_PATH + '.test-backup';

let tools;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ token: 'test-fake-token' }));
  const mod = await import('../connectors/notion.mjs');
  tools = mod.tools;
});

after(() => {
  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

function getTool(name) {
  return tools.find(t => t.name === name);
}

function mockFetch(status, body) {
  mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

describe('notion handlers', () => {

afterEach(() => {
  mock.restoreAll();
});

describe('notion_search handler', () => {
  it('returns formatted page results', async () => {
    mockFetch(200, {
      results: [
        {
          object: 'page',
          id: 'p1',
          properties: {
            title: { type: 'title', title: [{ plain_text: 'My Page' }] },
          },
          last_edited_time: '2026-03-28T00:00:00Z',
        },
      ],
      has_more: false,
    });
    const tool = getTool('notion_search');
    const result = await tool.handler({ query: 'My Page' });
    assert.ok(result.includes('My Page'));
    assert.ok(result.includes('[id: p1]'));
  });

  it('returns formatted database results', async () => {
    mockFetch(200, {
      results: [
        {
          object: 'database',
          id: 'db1',
          title: [{ plain_text: 'Tasks DB' }],
          properties: { Name: {}, Status: {}, Priority: {} },
        },
      ],
      has_more: false,
    });
    const tool = getTool('notion_search');
    const result = await tool.handler({ query: 'Tasks' });
    assert.ok(result.includes('Tasks DB'));
    assert.ok(result.includes('3 properties'));
    assert.ok(result.includes('[id: db1]'));
  });

  it('sends query and page_size in POST body', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_search');
    await tool.handler({ query: 'test', limit: 5 });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/search'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.query, 'test');
    assert.equal(body.page_size, 5);
  });

  it('returns message when no results', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_search');
    const result = await tool.handler({ query: 'nonexistent' });
    assert.equal(result, 'No results found.');
  });

  it('sends Bearer token and Notion-Version header', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_search');
    await tool.handler({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.headers['Authorization'], 'Bearer test-fake-token');
    assert.equal(opts.headers['Notion-Version'], '2022-06-28');
  });
});

describe('notion_get_page handler', () => {
  it('returns formatted page properties', async () => {
    mockFetch(200, {
      id: 'p1',
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'Test Page' }] },
        Status: { type: 'select', select: { name: 'Active' } },
      },
    });
    const tool = getTool('notion_get_page');
    const result = await tool.handler({ pageId: 'p1' });
    assert.ok(result.includes('Test Page'));
    assert.ok(result.includes('[id: p1]'));
    assert.ok(result.includes('Status: Active'));
  });

  it('calls correct endpoint', async () => {
    mockFetch(200, {
      id: 'p1',
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'Page' }] },
      },
    });
    const tool = getTool('notion_get_page');
    await tool.handler({ pageId: 'abc-123' });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/pages/abc-123'));
    assert.equal(opts.method, 'GET');
  });
});

describe('notion_get_page_content handler', () => {
  it('returns formatted blocks', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callCount++;
      // First call: GET /pages/{id} for the title
      if (url.includes('/pages/')) {
        return {
          ok: true, status: 200,
          json: async () => ({
            id: 'p1',
            properties: {
              Name: { type: 'title', title: [{ plain_text: 'Content Page' }] },
            },
          }),
          text: async () => '{}',
        };
      }
      // Second call: GET /blocks/{id}/children
      return {
        ok: true, status: 200,
        json: async () => ({
          results: [
            {
              type: 'paragraph',
              paragraph: { rich_text: [{ plain_text: 'Hello world' }] },
              has_children: false,
            },
            {
              type: 'heading_1',
              heading_1: { rich_text: [{ plain_text: 'Section Title' }] },
              has_children: false,
            },
          ],
          has_more: false,
        }),
        text: async () => '{}',
      };
    });
    const tool = getTool('notion_get_page_content');
    const result = await tool.handler({ pageId: 'p1' });
    assert.ok(result.includes('Content Page'));
    assert.ok(result.includes('Hello world'));
    assert.ok(result.includes('# Section Title'));
  });
});

describe('notion_list_databases handler', () => {
  it('returns formatted database list', async () => {
    mockFetch(200, {
      results: [
        {
          object: 'database',
          id: 'db1',
          title: [{ plain_text: 'Tasks DB' }],
          properties: { Name: {}, Status: {} },
        },
        {
          object: 'database',
          id: 'db2',
          title: [{ plain_text: 'Projects DB' }],
          properties: { Title: {} },
        },
      ],
      has_more: false,
    });
    const tool = getTool('notion_list_databases');
    const result = await tool.handler({});
    assert.ok(result.includes('Tasks DB'));
    assert.ok(result.includes('Projects DB'));
    assert.ok(result.includes('[id: db1]'));
    assert.ok(result.includes('[id: db2]'));
  });

  it('sends database filter in POST body', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_list_databases');
    await tool.handler({ limit: 10 });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/search'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.filter, { value: 'database', property: 'object' });
    assert.equal(body.page_size, 10);
  });

  it('returns message when no databases found', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_list_databases');
    const result = await tool.handler({});
    assert.equal(result, 'No databases found.');
  });
});

describe('notion_query_database handler', () => {
  it('returns formatted query results', async () => {
    mockFetch(200, {
      results: [
        {
          object: 'page',
          id: 'p2',
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'Task 1' }] },
            Status: { type: 'select', select: { name: 'Done' } },
          },
        },
      ],
      has_more: false,
    });
    const tool = getTool('notion_query_database');
    const result = await tool.handler({ databaseId: 'db1' });
    assert.ok(result.includes('Task 1'));
    assert.ok(result.includes('[id: p2]'));
    assert.ok(result.includes('Status: Done'));
  });

  it('sends filter and sorts in POST body', async () => {
    mockFetch(200, { results: [], has_more: false });
    const filter = { property: 'Status', select: { equals: 'Active' } };
    const sorts = [{ property: 'Name', direction: 'ascending' }];
    const tool = getTool('notion_query_database');
    await tool.handler({ databaseId: 'db1', filter, sorts, limit: 5 });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/databases/db1/query'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.filter, filter);
    assert.deepEqual(body.sorts, sorts);
    assert.equal(body.page_size, 5);
  });

  it('returns message when no results', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_query_database');
    const result = await tool.handler({ databaseId: 'db1' });
    assert.equal(result, 'No results found.');
  });
});

describe('notion_get_database handler', () => {
  it('returns schema info with property types', async () => {
    mockFetch(200, {
      id: 'db1',
      title: [{ plain_text: 'Tasks DB' }],
      properties: {
        Name: { type: 'title' },
        Status: {
          type: 'select',
          select: {
            options: [
              { name: 'Open' },
              { name: 'Done' },
            ],
          },
        },
        Priority: {
          type: 'multi_select',
          multi_select: {
            options: [
              { name: 'High' },
              { name: 'Low' },
            ],
          },
        },
      },
    });
    const tool = getTool('notion_get_database');
    const result = await tool.handler({ databaseId: 'db1' });
    assert.ok(result.includes('Tasks DB'));
    assert.ok(result.includes('[id: db1]'));
    assert.ok(result.includes('Name (title)'));
    assert.ok(result.includes('Status (select: Open, Done)'));
    assert.ok(result.includes('Priority (multi_select: High, Low)'));
  });

  it('calls correct endpoint', async () => {
    mockFetch(200, {
      id: 'db99', title: [{ plain_text: 'DB' }], properties: {},
    });
    const tool = getTool('notion_get_database');
    await tool.handler({ databaseId: 'db99' });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/databases/db99'));
    assert.equal(opts.method, 'GET');
  });
});

describe('notion_list_users handler', () => {
  it('returns formatted user list', async () => {
    mockFetch(200, {
      results: [
        { name: 'Alice', type: 'person', id: 'u1' },
        { name: 'Bot Helper', type: 'bot', id: 'u2' },
      ],
    });
    const tool = getTool('notion_list_users');
    const result = await tool.handler({});
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('person'));
    assert.ok(result.includes('[id: u1]'));
    assert.ok(result.includes('Bot Helper'));
    assert.ok(result.includes('bot'));
    assert.ok(result.includes('[id: u2]'));
  });

  it('returns message when no users found', async () => {
    mockFetch(200, { results: [] });
    const tool = getTool('notion_list_users');
    const result = await tool.handler({});
    assert.equal(result, 'No users found.');
  });

  it('calls GET /users', async () => {
    mockFetch(200, { results: [] });
    const tool = getTool('notion_list_users');
    await tool.handler({});
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/users'));
    assert.equal(opts.method, 'GET');
  });
});

describe('notion_get_block_children handler', () => {
  it('returns formatted child blocks with pagination', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({
            results: [
              {
                type: 'paragraph',
                paragraph: { rich_text: [{ plain_text: 'First block' }] },
                has_children: false,
              },
            ],
            has_more: true,
            next_cursor: 'cursor-abc',
          }),
          text: async () => '{}',
        };
      }
      // Second page
      return {
        ok: true, status: 200,
        json: async () => ({
          results: [
            {
              type: 'paragraph',
              paragraph: { rich_text: [{ plain_text: 'Second block' }] },
              has_children: false,
            },
          ],
          has_more: false,
        }),
        text: async () => '{}',
      };
    });
    const tool = getTool('notion_get_block_children');
    const result = await tool.handler({ blockId: 'block-1' });
    assert.ok(result.includes('First block'));
    assert.ok(result.includes('Second block'));
    // Verify pagination — second call should include cursor
    assert.equal(globalThis.fetch.mock.calls.length, 2);
    const secondUrl = globalThis.fetch.mock.calls[1].arguments[0];
    assert.ok(secondUrl.includes('start_cursor=cursor-abc'));
  });

  it('returns message when no children', async () => {
    mockFetch(200, { results: [], has_more: false });
    const tool = getTool('notion_get_block_children');
    const result = await tool.handler({ blockId: 'block-empty' });
    assert.equal(result, 'No child blocks found.');
  });
});

describe('notion error handling', () => {
  it('throws on 401 unauthorized response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
      text: async () => 'Unauthorized',
    }));
    const tool = getTool('notion_search');
    await assert.rejects(
      () => tool.handler({ query: 'test' }),
      (err) => {
        assert.ok(err.message.includes('401'));
        return true;
      }
    );
  });

  it('throws on 404 not found response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
      text: async () => 'Not Found',
    }));
    const tool = getTool('notion_get_page');
    await assert.rejects(
      () => tool.handler({ pageId: 'nonexistent' }),
      (err) => {
        assert.ok(err.message.includes('404'));
        return true;
      }
    );
  });
});

}); // end notion handlers
