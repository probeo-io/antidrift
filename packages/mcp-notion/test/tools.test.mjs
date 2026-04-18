/**
 * Comprehensive unit tests for mcp-notion tools
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
    ctx: { credentials: { token: 'test-notion-token' }, fetch },
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
  const {
    createClient, API_BASE, NOTION_VERSION,
    getPageTitle, formatPage, formatDatabase,
    formatRichText, formatBlock, formatProperties
  } = await import('../lib/client.mjs');

  it('exports correct API_BASE', () => {
    assert.equal(API_BASE, 'https://api.notion.com/v1');
  });

  it('exports NOTION_VERSION', () => {
    assert.equal(typeof NOTION_VERSION, 'string');
    assert.ok(NOTION_VERSION.length > 0);
  });

  it('sends Authorization Bearer header', async () => {
    const { ctx, getCall } = makeCtx({});
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await notion('GET', '/users');
    assert.equal(getCall().opts.headers['Authorization'], 'Bearer test-notion-token');
  });

  it('sends Notion-Version header', async () => {
    const { ctx, getCall } = makeCtx({});
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await notion('GET', '/users');
    assert.equal(getCall().opts.headers['Notion-Version'], NOTION_VERSION);
  });

  it('sends Content-Type application/json', async () => {
    const { ctx, getCall } = makeCtx({});
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await notion('GET', '/users');
    assert.equal(getCall().opts.headers['Content-Type'], 'application/json');
  });

  it('builds correct URL from path', async () => {
    const { ctx, getCall } = makeCtx({});
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await notion('GET', '/users');
    assert.ok(getCall().url.startsWith('https://api.notion.com/v1/users'));
  });

  it('serializes body for POST', async () => {
    const { ctx, getCall } = makeCtx({});
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await notion('POST', '/search', { query: 'test' });
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.query, 'test');
  });

  it('omits body for GET', async () => {
    const { ctx, getCall } = makeCtx({});
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await notion('GET', '/users');
    assert.equal(getCall().opts.body, undefined);
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401, 'Unauthorized');
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => notion('GET', '/users'), /Notion API 401/);
  });

  it('throws on 404', async () => {
    const { ctx } = makeErrCtx(404);
    const { notion } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => notion('GET', '/pages/bad-id'), /404/);
  });

  it('fetchAllChildren paginates using has_more / next_cursor', async () => {
    const page1 = { results: [{ id: 'b1', type: 'paragraph', has_children: false }], has_more: true, next_cursor: 'cur1' };
    const page2 = { results: [{ id: 'b2', type: 'paragraph', has_children: false }], has_more: false, next_cursor: null };
    const { ctx } = makeCtx(null, { responses: [page1, page2] });
    const { fetchAllChildren } = createClient(ctx.credentials, ctx.fetch);
    const blocks = await fetchAllChildren('page-id');
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].id, 'b1');
    assert.equal(blocks[1].id, 'b2');
  });

  it('getPageTitle — returns title from title property', () => {
    const page = {
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'My Page' }] }
      }
    };
    assert.equal(getPageTitle(page), 'My Page');
  });

  it('getPageTitle — returns "Untitled" when no title prop', () => {
    assert.equal(getPageTitle({ properties: {} }), 'Untitled');
    assert.equal(getPageTitle({ properties: { Status: { type: 'select' } } }), 'Untitled');
  });

  it('formatPage — includes page id', () => {
    const page = { id: 'page-1', properties: { Title: { type: 'title', title: [{ plain_text: 'Hello' }] } } };
    const line = formatPage(page);
    assert.ok(line.includes('Hello'));
    assert.ok(line.includes('[id: page-1]'));
  });

  it('formatDatabase — includes db title, property count, and id', () => {
    const db = {
      id: 'db-1',
      title: [{ plain_text: 'Tasks' }],
      properties: { Name: {}, Status: {}, Priority: {} }
    };
    const line = formatDatabase(db);
    assert.ok(line.includes('Tasks'));
    assert.ok(line.includes('3 properties'));
    assert.ok(line.includes('[id: db-1]'));
  });

  it('formatRichText — joins plain_text values', () => {
    const rich = [{ plain_text: 'Hello ' }, { plain_text: 'World' }];
    assert.equal(formatRichText(rich), 'Hello World');
  });

  it('formatRichText — returns empty string for empty array', () => {
    assert.equal(formatRichText([]), '');
    assert.equal(formatRichText(null), '');
  });

  it('formatBlock — paragraph', () => {
    const block = { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'A paragraph' }] } };
    assert.equal(formatBlock(block), 'A paragraph');
  });

  it('formatBlock — heading_1', () => {
    const block = { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title' }] } };
    const out = formatBlock(block);
    assert.ok(out.startsWith('# Title'));
  });

  it('formatBlock — bulleted_list_item', () => {
    const block = { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item' }] } };
    assert.ok(formatBlock(block).startsWith('- Item'));
  });

  it('formatBlock — to_do checked', () => {
    const block = { type: 'to_do', to_do: { checked: true, rich_text: [{ plain_text: 'Done' }] } };
    assert.ok(formatBlock(block).includes('[x]'));
  });

  it('formatBlock — to_do unchecked', () => {
    const block = { type: 'to_do', to_do: { checked: false, rich_text: [{ plain_text: 'Not Done' }] } };
    assert.ok(formatBlock(block).includes('[ ]'));
  });

  it('formatBlock — divider', () => {
    const block = { type: 'divider', divider: {} };
    assert.ok(formatBlock(block).includes('---'));
  });

  it('formatBlock — unknown type returns [type]', () => {
    const block = { type: 'file', file: {} };
    assert.equal(formatBlock(block), '[file]');
  });

  it('formatProperties — renders various property types', () => {
    const properties = {
      Name: { type: 'title', title: [{ plain_text: 'Test Page' }] },
      Count: { type: 'number', number: 42 },
      Status: { type: 'select', select: { name: 'Active' } },
      Tags: { type: 'multi_select', multi_select: [{ name: 'alpha' }, { name: 'beta' }] },
      Done: { type: 'checkbox', checkbox: true },
      Link: { type: 'url', url: 'https://example.com' },
    };
    const lines = formatProperties(properties);
    assert.ok(lines.some(l => l.includes('Test Page')));
    assert.ok(lines.some(l => l.includes('42')));
    assert.ok(lines.some(l => l.includes('Active')));
    assert.ok(lines.some(l => l.includes('alpha') && l.includes('beta')));
    assert.ok(lines.some(l => l.includes('https://example.com')));
  });
});

// ---------------------------------------------------------------------------
// tools/search.mjs
// ---------------------------------------------------------------------------

describe('tools/search.mjs', async () => {
  const tool = (await import('../tools/search.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 0);
    assert.equal(typeof tool.input, 'object');
    assert.equal(typeof tool.execute, 'function');
  });

  it('POSTs to /search', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ query: 'hello' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/search'));
  });

  it('sends query in body', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ query: 'my search' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.query, 'my search');
  });

  it('omits query key when query is empty', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ query: '' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.query, undefined);
  });

  it('returns "No results found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ query: 'nothing' }, ctx);
    assert.equal(out, 'No results found.');
  });

  it('formats page results', async () => {
    const { ctx } = makeCtx({
      results: [{
        object: 'page', id: 'p1',
        properties: { Title: { type: 'title', title: [{ plain_text: 'My Page' }] } }
      }]
    });
    const out = await tool.execute({ query: 'my' }, ctx);
    assert.ok(out.includes('My Page'));
    assert.ok(out.includes('[id: p1]'));
  });

  it('formats database results differently from pages', async () => {
    const { ctx } = makeCtx({
      results: [{
        object: 'database', id: 'db1',
        title: [{ plain_text: 'My DB' }],
        properties: { Name: {}, Status: {} }
      }]
    });
    const out = await tool.execute({ query: 'db' }, ctx);
    assert.ok(out.includes('My DB'));
    assert.ok(out.includes('2 properties'));
  });

  it('respects page_size limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.page_size, 5);
  });
});

// ---------------------------------------------------------------------------
// tools/get_page.mjs
// ---------------------------------------------------------------------------

describe('tools/get_page.mjs', async () => {
  const tool = (await import('../tools/get_page.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /pages/:pageId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'p10', properties: {}, url: null });
    await tool.execute({ pageId: 'p10' }, ctx);
    assert.ok(getCall().url.includes('/pages/p10'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns page title and id', async () => {
    const { ctx } = makeCtx({
      id: 'p10',
      properties: { Title: { type: 'title', title: [{ plain_text: 'Project Plan' }] } },
      url: 'https://notion.so/p10'
    });
    const out = await tool.execute({ pageId: 'p10' }, ctx);
    assert.ok(out.includes('Project Plan'));
    assert.ok(out.includes('[id: p10]'));
    assert.ok(out.includes('https://notion.so/p10'));
  });

  it('includes formatted properties', async () => {
    const { ctx } = makeCtx({
      id: 'p11',
      properties: {
        Title: { type: 'title', title: [{ plain_text: 'Task' }] },
        Status: { type: 'select', select: { name: 'Done' } },
      },
      url: null
    });
    const out = await tool.execute({ pageId: 'p11' }, ctx);
    assert.ok(out.includes('Status'));
    assert.ok(out.includes('Done'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ pageId: 'bad-id' }, ctx), /Notion API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/get_page_content.mjs
// ---------------------------------------------------------------------------

describe('tools/get_page_content.mjs', async () => {
  const tool = (await import('../tools/get_page_content.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('fetches page then block children', async () => {
    const responses = [
      // GET /pages/:pageId
      { id: 'p20', properties: { Title: { type: 'title', title: [{ plain_text: 'Docs' }] } } },
      // GET /blocks/p20/children (first pagination call)
      { results: [
        { id: 'b1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello' }] }, has_children: false }
      ], has_more: false }
    ];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ pageId: 'p20' }, ctx);
    assert.ok(out.includes('Docs'));
    assert.ok(out.includes('Hello'));
  });

  it('returns title even for pages with no blocks', async () => {
    const responses = [
      { id: 'p21', properties: { Title: { type: 'title', title: [{ plain_text: 'Empty Page' }] } } },
      { results: [], has_more: false }
    ];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ pageId: 'p21' }, ctx);
    assert.ok(out.includes('Empty Page'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => tool.execute({ pageId: 'private' }, ctx), /Notion API 403/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_databases.mjs
// ---------------------------------------------------------------------------

describe('tools/list_databases.mjs', async () => {
  const tool = (await import('../tools/list_databases.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('POSTs to /search with database filter', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/search'));
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.filter.value, 'database');
    assert.equal(body.filter.property, 'object');
  });

  it('returns "No databases found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No databases found.');
  });

  it('returns formatted database lines', async () => {
    const { ctx } = makeCtx({
      results: [{
        id: 'db1',
        title: [{ plain_text: 'Projects' }],
        properties: { Name: {}, Status: {}, Due: {} }
      }]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Projects'));
    assert.ok(out.includes('3 properties'));
    assert.ok(out.includes('[id: db1]'));
  });

  it('respects limit via page_size (capped at 100)', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.page_size, 5);
  });

  it('caps page_size at 100', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 200 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.page_size, 100);
  });
});

// ---------------------------------------------------------------------------
// tools/query_database.mjs
// ---------------------------------------------------------------------------

describe('tools/query_database.mjs', async () => {
  const tool = (await import('../tools/query_database.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('POSTs to /databases/:databaseId/query', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ databaseId: 'db-abc' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/databases/db-abc/query'));
  });

  it('returns "No results found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ databaseId: 'db-abc' }, ctx);
    assert.equal(out, 'No results found.');
  });

  it('returns formatted page results', async () => {
    const { ctx } = makeCtx({
      results: [{
        id: 'row1',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Task Alpha' }] },
          Status: { type: 'select', select: { name: 'In Progress' } }
        }
      }]
    });
    const out = await tool.execute({ databaseId: 'db-abc' }, ctx);
    assert.ok(out.includes('Task Alpha'));
    assert.ok(out.includes('[id: row1]'));
  });

  it('passes filter and sorts in request body', async () => {
    const filter = { property: 'Status', select: { equals: 'Done' } };
    const sorts = [{ property: 'Name', direction: 'ascending' }];
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ databaseId: 'db-xyz', filter, sorts }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.deepEqual(body.filter, filter);
    assert.deepEqual(body.sorts, sorts);
  });

  it('does not include filter/sorts when not provided', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ databaseId: 'db-xyz' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.filter, undefined);
    assert.equal(body.sorts, undefined);
  });

  it('caps page_size at 100', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ databaseId: 'db-xyz', limit: 500 }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.page_size, 100);
  });
});

// ---------------------------------------------------------------------------
// tools/get_database.mjs
// ---------------------------------------------------------------------------

describe('tools/get_database.mjs', async () => {
  const tool = (await import('../tools/get_database.mjs')).default;

  it('GETs /databases/:databaseId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'db5', title: [{ plain_text: 'DB' }], properties: {} });
    await tool.execute({ databaseId: 'db5' }, ctx);
    assert.ok(getCall().url.includes('/databases/db5'));
  });

  it('returns database title and properties', async () => {
    const { ctx } = makeCtx({
      id: 'db6',
      title: [{ plain_text: 'Tasks DB' }],
      properties: {
        Name: { type: 'title' },
        Priority: { type: 'select', select: { options: [{ name: 'High' }, { name: 'Low' }] } },
        Tags: { type: 'multi_select', multi_select: { options: [{ name: 'bug' }] } }
      }
    });
    const out = await tool.execute({ databaseId: 'db6' }, ctx);
    assert.ok(out.includes('Tasks DB'));
    assert.ok(out.includes('[id: db6]'));
    assert.ok(out.includes('Priority'));
    assert.ok(out.includes('High'));
    assert.ok(out.includes('Tags'));
    assert.ok(out.includes('bug'));
  });

  it('handles status property options', async () => {
    const { ctx } = makeCtx({
      id: 'db7', title: [{ plain_text: 'Work' }],
      properties: { Status: { type: 'status', status: { options: [{ name: 'Todo' }, { name: 'Done' }] } } }
    });
    const out = await tool.execute({ databaseId: 'db7' }, ctx);
    assert.ok(out.includes('Todo'));
    assert.ok(out.includes('Done'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ databaseId: 'bad' }, ctx), /Notion API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_users.mjs
// ---------------------------------------------------------------------------

describe('tools/list_users.mjs', async () => {
  const tool = (await import('../tools/list_users.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /users', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('/users'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns "No users found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No users found.');
  });

  it('returns formatted user lines', async () => {
    const { ctx } = makeCtx({
      results: [
        { id: 'u1', name: 'Alice', type: 'person' },
        { id: 'u2', name: 'Autobot', type: 'bot' },
      ]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('person'));
    assert.ok(out.includes('Autobot'));
    assert.ok(out.includes('bot'));
    assert.ok(out.includes('[id: u1]'));
  });

  it('distinguishes bot from human users', async () => {
    const { ctx } = makeCtx({
      results: [
        { id: 'u3', name: 'Human', type: 'person' },
        { id: 'u4', name: 'Bot User', type: 'bot' },
      ]
    });
    const out = await tool.execute({}, ctx);
    const lines = out.split('\n');
    const humanLine = lines.find(l => l.includes('Human'));
    const botLine = lines.find(l => l.includes('Bot User'));
    assert.ok(humanLine);
    assert.ok(botLine);
    // Bot line uses robot emoji, human line uses person emoji
    assert.notEqual(humanLine[0], botLine[0]);
  });
});

// ---------------------------------------------------------------------------
// tools/get_block.mjs
// ---------------------------------------------------------------------------

describe('tools/get_block.mjs', async () => {
  const tool = (await import('../tools/get_block.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /blocks/:blockId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'blk1', type: 'paragraph', paragraph: { rich_text: [] } });
    await tool.execute({ blockId: 'blk1' }, ctx);
    assert.ok(getCall().url.includes('/blocks/blk1'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns formatted block content', async () => {
    const { ctx } = makeCtx({
      id: 'blk2', type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: 'Block content here' }] }
    });
    const out = await tool.execute({ blockId: 'blk2' }, ctx);
    assert.ok(out.includes('Block content here'));
  });

  it('handles heading block', async () => {
    const { ctx } = makeCtx({
      id: 'blk3', type: 'heading_1',
      heading_1: { rich_text: [{ plain_text: 'Big Heading' }] }
    });
    const out = await tool.execute({ blockId: 'blk3' }, ctx);
    assert.ok(out.includes('Big Heading'));
    assert.ok(out.startsWith('#'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ blockId: 'bad-block' }, ctx), /Notion API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/get_block_children.mjs
// ---------------------------------------------------------------------------

describe('tools/get_block_children.mjs', async () => {
  const tool = (await import('../tools/get_block_children.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('fetches children of block', async () => {
    const responses = [{
      results: [
        { id: 'c1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Child 1' }] }, has_children: false },
        { id: 'c2', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item A' }] }, has_children: false },
      ],
      has_more: false
    }];
    const { ctx, getCall } = makeCtx(null, { responses });
    const out = await tool.execute({ blockId: 'parent-blk' }, ctx);
    assert.ok(getCall().url.includes('/blocks/parent-blk/children'));
    assert.ok(out.includes('Child 1'));
    assert.ok(out.includes('Item A'));
  });

  it('returns "No child blocks found." when empty', async () => {
    const responses = [{ results: [], has_more: false }];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ blockId: 'empty-blk' }, ctx);
    assert.equal(out, 'No child blocks found.');
  });

  it('paginates when has_more is true', async () => {
    const responses = [
      { results: [{ id: 'b1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'P1' }] }, has_children: false }], has_more: true, next_cursor: 'next' },
      { results: [{ id: 'b2', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'P2' }] }, has_children: false }], has_more: false },
    ];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ blockId: 'paged-blk' }, ctx);
    assert.ok(out.includes('P1'));
    assert.ok(out.includes('P2'));
  });
});
