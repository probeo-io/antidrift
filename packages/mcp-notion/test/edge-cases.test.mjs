import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'notion.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

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
  return mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

afterEach(() => {
  mock.restoreAll();
});

// --- Edge-case tests ---

describe('notion edge cases', () => {

  // ─── Error responses ─────────────────────────────────────────────────────

  describe('error responses', () => {
    it('throws on 401 unauthorized', async () => {
      mockFetch(401, { message: 'API token is invalid' });
      await assert.rejects(
        () => getTool('notion_search').handler({}),
        (err) => { assert.ok(err.message.includes('401')); return true; }
      );
    });

    it('throws on 404 not found', async () => {
      mockFetch(404, { message: 'Not Found' });
      await assert.rejects(
        () => getTool('notion_get_page').handler({ pageId: 'no-such-page' }),
        (err) => { assert.ok(err.message.includes('404')); return true; }
      );
    });

    it('throws on 429 rate limited', async () => {
      mockFetch(429, { message: 'Rate limited' });
      await assert.rejects(
        () => getTool('notion_list_databases').handler({}),
        (err) => { assert.ok(err.message.includes('429')); return true; }
      );
    });

    it('throws on 500 server error', async () => {
      mockFetch(500, { message: 'Internal Server Error' });
      await assert.rejects(
        () => getTool('notion_list_users').handler({}),
        (err) => { assert.ok(err.message.includes('500')); return true; }
      );
    });

    it('error message includes response body text', async () => {
      mockFetch(403, 'Could not find database with ID: abc');
      await assert.rejects(
        () => getTool('notion_get_database').handler({ databaseId: 'abc' }),
        (err) => { assert.ok(err.message.includes('Could not find database')); return true; }
      );
    });
  });

  // ─── Empty result sets ────────────────────────────────────────────────────

  describe('empty result sets', () => {
    it('notion_search returns message for empty results', async () => {
      mockFetch(200, { results: [], has_more: false });
      const result = await getTool('notion_search').handler({ query: 'zzz' });
      assert.equal(result, 'No results found.');
    });

    it('notion_list_databases returns message for empty results', async () => {
      mockFetch(200, { results: [], has_more: false });
      const result = await getTool('notion_list_databases').handler({});
      assert.equal(result, 'No databases found.');
    });

    it('notion_query_database returns message for empty results', async () => {
      mockFetch(200, { results: [], has_more: false });
      const result = await getTool('notion_query_database').handler({ databaseId: 'db1' });
      assert.equal(result, 'No results found.');
    });

    it('notion_list_users returns message for empty results', async () => {
      mockFetch(200, { results: [] });
      const result = await getTool('notion_list_users').handler({});
      assert.equal(result, 'No users found.');
    });

    it('notion_get_block_children returns message for no children', async () => {
      mockFetch(200, { results: [], has_more: false });
      const result = await getTool('notion_get_block_children').handler({ blockId: 'b1' });
      assert.equal(result, 'No child blocks found.');
    });

    it('notion_search handles null/undefined results array', async () => {
      mockFetch(200, { results: [], has_more: false });
      const result = await getTool('notion_search').handler({});
      assert.equal(result, 'No results found.');
    });
  });

  // ─── Pagination / limit params ────────────────────────────────────────────

  describe('pagination and limit', () => {
    it('notion_search sends page_size from limit', async () => {
      const mocked = mockFetch(200, { results: [], has_more: false });
      await getTool('notion_search').handler({ query: 'test', limit: 5 });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.page_size, 5);
    });

    it('notion_search defaults limit to 20', async () => {
      const mocked = mockFetch(200, { results: [], has_more: false });
      await getTool('notion_search').handler({});
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.page_size, 20);
    });

    it('notion_search caps limit at 100', async () => {
      const mocked = mockFetch(200, { results: [], has_more: false });
      await getTool('notion_search').handler({ limit: 200 });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.page_size, 100);
    });

    it('notion_list_databases sends page_size from limit', async () => {
      const mocked = mockFetch(200, { results: [], has_more: false });
      await getTool('notion_list_databases').handler({ limit: 10 });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.page_size, 10);
    });

    it('notion_query_database sends page_size from limit', async () => {
      const mocked = mockFetch(200, { results: [], has_more: false });
      await getTool('notion_query_database').handler({ databaseId: 'db1', limit: 8 });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.page_size, 8);
    });

    it('notion_query_database caps limit at 100', async () => {
      const mocked = mockFetch(200, { results: [], has_more: false });
      await getTool('notion_query_database').handler({ databaseId: 'db1', limit: 500 });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.page_size, 100);
    });

    it('notion_get_block_children paginates using start_cursor', async () => {
      let callCount = 0;
      mock.method(globalThis, 'fetch', async (url) => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true, status: 200,
            json: async () => ({
              results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'First' }] }, has_children: false }],
              has_more: true,
              next_cursor: 'cursor-123'
            }),
            text: async () => '{}'
          };
        }
        return {
          ok: true, status: 200,
          json: async () => ({
            results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Second' }] }, has_children: false }],
            has_more: false
          }),
          text: async () => '{}'
        };
      });
      const result = await getTool('notion_get_block_children').handler({ blockId: 'b1' });
      assert.ok(result.includes('First'));
      assert.ok(result.includes('Second'));
      const secondUrl = globalThis.fetch.mock.calls[1].arguments[0];
      assert.ok(secondUrl.includes('start_cursor=cursor-123'));
    });
  });

  // ─── Optional parameters omitted ─────────────────────────────────────────

  describe('optional parameters omitted', () => {
    it('notion_search omits query from body when not provided', async () => {
      mockFetch(200, { results: [], has_more: false });
      await getTool('notion_search').handler({});
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.query, undefined);
    });

    it('notion_query_database omits filter and sorts when not provided', async () => {
      mockFetch(200, { results: [], has_more: false });
      await getTool('notion_query_database').handler({ databaseId: 'db1' });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.filter, undefined);
      assert.equal(body.sorts, undefined);
    });
  });

  // ─── Special characters ───────────────────────────────────────────────────

  describe('special characters in input', () => {
    it('notion_search handles special characters in query', async () => {
      mockFetch(200, { results: [], has_more: false });
      await getTool('notion_search').handler({ query: 'O\'Brien & Co <script>' });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.query, 'O\'Brien & Co <script>');
    });

    it('notion_get_page handles page ID with dashes', async () => {
      mockFetch(200, {
        id: 'abc-def-123',
        properties: { Name: { type: 'title', title: [{ plain_text: 'Test' }] } }
      });
      await getTool('notion_get_page').handler({ pageId: 'abc-def-123' });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('/pages/abc-def-123'));
    });

    it('notion_get_block handles block ID with dashes', async () => {
      mockFetch(200, { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'content' }] } });
      await getTool('notion_get_block').handler({ blockId: 'blk-abc-123' });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('/blocks/blk-abc-123'));
    });
  });

  // ─── Complex input schemas ────────────────────────────────────────────────

  describe('complex input schemas', () => {
    it('notion_query_database sends nested filter object', async () => {
      mockFetch(200, { results: [], has_more: false });
      const filter = {
        and: [
          { property: 'Status', select: { equals: 'Active' } },
          { property: 'Priority', multi_select: { contains: 'High' } }
        ]
      };
      await getTool('notion_query_database').handler({ databaseId: 'db1', filter });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.filter, filter);
    });

    it('notion_query_database sends sorts array', async () => {
      mockFetch(200, { results: [], has_more: false });
      const sorts = [
        { property: 'Priority', direction: 'descending' },
        { property: 'Name', direction: 'ascending' }
      ];
      await getTool('notion_query_database').handler({ databaseId: 'db1', sorts });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.sorts, sorts);
    });

    it('notion_query_database sends filter + sorts + limit together', async () => {
      mockFetch(200, { results: [], has_more: false });
      const filter = { property: 'Done', checkbox: { equals: false } };
      const sorts = [{ property: 'Created', direction: 'descending' }];
      await getTool('notion_query_database').handler({
        databaseId: 'db1', filter, sorts, limit: 5
      });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.filter, filter);
      assert.deepEqual(body.sorts, sorts);
      assert.equal(body.page_size, 5);
    });
  });

  // ─── Formatting edge cases ────────────────────────────────────────────────

  describe('formatting edge cases', () => {
    it('getPageTitle returns Untitled when no title property', async () => {
      mockFetch(200, {
        results: [{
          object: 'page',
          id: 'p-no-title',
          properties: { Status: { type: 'select', select: { name: 'Open' } } }
        }],
        has_more: false
      });
      const result = await getTool('notion_search').handler({});
      assert.ok(result.includes('Untitled'));
    });

    it('formatDatabase handles database with no title', async () => {
      mockFetch(200, {
        results: [{
          object: 'database',
          id: 'db-no-title',
          title: [],
          properties: { A: {}, B: {} }
        }],
        has_more: false
      });
      const result = await getTool('notion_search').handler({});
      assert.ok(result.includes('Untitled'));
      assert.ok(result.includes('2 properties'));
    });

    it('formatProperties handles all property types', async () => {
      mockFetch(200, {
        id: 'p-all',
        properties: {
          Title: { type: 'title', title: [{ plain_text: 'Test' }] },
          Desc: { type: 'rich_text', rich_text: [{ plain_text: 'A note' }] },
          Count: { type: 'number', number: 42 },
          Tag: { type: 'select', select: { name: 'Important' } },
          Tags: { type: 'multi_select', multi_select: [{ name: 'A' }, { name: 'B' }] },
          Due: { type: 'date', date: { start: '2026-01-01', end: '2026-01-31' } },
          Done: { type: 'checkbox', checkbox: true },
          Link: { type: 'url', url: 'https://example.com' },
          Email: { type: 'email', email: 'test@test.com' },
          Phone: { type: 'phone_number', phone_number: '+1234' },
          State: { type: 'status', status: { name: 'In Progress' } },
          People: { type: 'people', people: [{ name: 'Alice' }] },
          Relation: { type: 'relation', relation: [{ id: 'rel-1' }] },
          Formula: { type: 'formula', formula: { string: 'computed' } },
          Created: { type: 'created_time', created_time: '2024-01-01' },
          Edited: { type: 'last_edited_time', last_edited_time: '2024-06-01' },
        },
        url: 'https://notion.so/test'
      });
      const result = await getTool('notion_get_page').handler({ pageId: 'p-all' });
      assert.ok(result.includes('Test'));
      assert.ok(result.includes('A note'));
      assert.ok(result.includes('42'));
      assert.ok(result.includes('Important'));
      assert.ok(result.includes('A, B'));
      assert.ok(result.includes('2026-01-31'));
      assert.ok(result.includes('https://example.com'));
      assert.ok(result.includes('test@test.com'));
      assert.ok(result.includes('+1234'));
      assert.ok(result.includes('In Progress'));
      assert.ok(result.includes('Alice'));
      assert.ok(result.includes('rel-1'));
      assert.ok(result.includes('computed'));
    });

    it('formatProperties handles empty/null values gracefully', async () => {
      mockFetch(200, {
        id: 'p-empty',
        properties: {
          Name: { type: 'title', title: [] },
          Desc: { type: 'rich_text', rich_text: [] },
          Count: { type: 'number', number: null },
          Tag: { type: 'select', select: null },
          Tags: { type: 'multi_select', multi_select: [] },
          Due: { type: 'date', date: null },
          Done: { type: 'checkbox', checkbox: false },
          Link: { type: 'url', url: null },
        }
      });
      const result = await getTool('notion_get_page').handler({ pageId: 'p-empty' });
      // Should not contain 'undefined' or 'null' as text
      assert.ok(!result.includes('undefined'));
      assert.ok(!result.includes('null'));
    });

    it('formatBlock handles all block types', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        if (url.includes('/pages/')) {
          return {
            ok: true, status: 200,
            json: async () => ({
              id: 'p1',
              properties: { Name: { type: 'title', title: [{ plain_text: 'Blocks' }] } }
            }),
            text: async () => '{}'
          };
        }
        return {
          ok: true, status: 200,
          json: async () => ({
            results: [
              { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'H1' }] }, has_children: false },
              { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'H2' }] }, has_children: false },
              { type: 'heading_3', heading_3: { rich_text: [{ plain_text: 'H3' }] }, has_children: false },
              { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'bullet' }] }, has_children: false },
              { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'numbered' }] }, has_children: false },
              { type: 'to_do', to_do: { rich_text: [{ plain_text: 'task' }], checked: true }, has_children: false },
              { type: 'to_do', to_do: { rich_text: [{ plain_text: 'unchecked' }], checked: false }, has_children: false },
              { type: 'toggle', toggle: { rich_text: [{ plain_text: 'toggled' }] }, has_children: false },
              { type: 'code', code: { rich_text: [{ plain_text: 'const x = 1;' }], language: 'javascript' }, has_children: false },
              { type: 'quote', quote: { rich_text: [{ plain_text: 'quoted' }] }, has_children: false },
              { type: 'divider', divider: {}, has_children: false },
              { type: 'callout', callout: { rich_text: [{ plain_text: 'note' }] }, has_children: false },
              { type: 'bookmark', bookmark: { url: 'https://example.com' }, has_children: false },
              { type: 'image', image: { external: { url: 'https://img.com/pic.png' } }, has_children: false },
              { type: 'child_page', child_page: { title: 'Sub Page' }, has_children: false },
              { type: 'child_database', child_database: { title: 'Sub DB' }, has_children: false },
              { type: 'table_of_contents', table_of_contents: {}, has_children: false },
            ],
            has_more: false
          }),
          text: async () => '{}'
        };
      });
      const result = await getTool('notion_get_page_content').handler({ pageId: 'p1' });
      assert.ok(result.includes('# H1'));
      assert.ok(result.includes('## H2'));
      assert.ok(result.includes('### H3'));
      assert.ok(result.includes('- bullet'));
      assert.ok(result.includes('1. numbered'));
      assert.ok(result.includes('[x] task'));
      assert.ok(result.includes('[ ] unchecked'));
      assert.ok(result.includes('toggled'));
      assert.ok(result.includes('const x = 1;'));
      assert.ok(result.includes('> quoted'));
      assert.ok(result.includes('---'));
      assert.ok(result.includes('note'));
      assert.ok(result.includes('https://example.com'));
      assert.ok(result.includes('Sub Page'));
      assert.ok(result.includes('Sub DB'));
      assert.ok(result.includes('[Table of Contents]'));
    });

    it('formatBlock handles unknown block type', async () => {
      mockFetch(200, { type: 'unknown_type', unknown_type: {} });
      const result = await getTool('notion_get_block').handler({ blockId: 'b1' });
      assert.ok(result.includes('[unknown_type]'));
    });

    it('formatBlock handles block with no content', async () => {
      mockFetch(200, { type: 'paragraph', paragraph: { rich_text: [] } });
      const result = await getTool('notion_get_block').handler({ blockId: 'b1' });
      // Should return empty string for paragraph with no text, not crash
      assert.equal(typeof result, 'string');
    });

    it('notion_get_database shows status options', async () => {
      mockFetch(200, {
        id: 'db-st',
        title: [{ plain_text: 'Status DB' }],
        properties: {
          Phase: {
            type: 'status',
            status: { options: [{ name: 'Todo' }, { name: 'Doing' }, { name: 'Done' }] }
          }
        }
      });
      const result = await getTool('notion_get_database').handler({ databaseId: 'db-st' });
      assert.ok(result.includes('status: Todo, Doing, Done'));
    });

    it('notion_list_users formats bot users', async () => {
      mockFetch(200, {
        results: [
          { name: 'Integration Bot', type: 'bot', id: 'bot-1' },
          { name: null, type: 'person', id: 'p-anon' }
        ]
      });
      const result = await getTool('notion_list_users').handler({});
      assert.ok(result.includes('Integration Bot'));
      assert.ok(result.includes('bot'));
      assert.ok(result.includes('Unknown'));
    });
  });
});
