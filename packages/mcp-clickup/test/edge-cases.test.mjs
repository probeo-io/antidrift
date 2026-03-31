import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'clickup.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

let tools;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ apiToken: 'test-fake-token' }));
  const mod = await import('../connectors/clickup.mjs');
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

describe('clickup edge cases', () => {

  // ─── Error responses ─────────────────────────────────────────────────────

  describe('error responses', () => {
    it('throws on 401 unauthorized', async () => {
      mockFetch(401, { err: 'Unauthorized' });
      await assert.rejects(
        () => getTool('clickup_list_workspaces').handler({}),
        (err) => { assert.ok(err.message.includes('401')); return true; }
      );
    });

    it('throws on 404 not found', async () => {
      mockFetch(404, { err: 'Not Found' });
      await assert.rejects(
        () => getTool('clickup_get_task').handler({ taskId: 'no-such' }),
        (err) => { assert.ok(err.message.includes('404')); return true; }
      );
    });

    it('throws on 429 rate limited', async () => {
      mockFetch(429, { err: 'Rate limit exceeded' });
      await assert.rejects(
        () => getTool('clickup_list_spaces').handler({ teamId: '1' }),
        (err) => { assert.ok(err.message.includes('429')); return true; }
      );
    });

    it('throws on 500 server error', async () => {
      mockFetch(500, { err: 'Internal Server Error' });
      await assert.rejects(
        () => getTool('clickup_list_tasks').handler({ listId: 'l1' }),
        (err) => { assert.ok(err.message.includes('500')); return true; }
      );
    });

    it('error message includes response body text', async () => {
      mockFetch(403, 'Access denied for team');
      await assert.rejects(
        () => getTool('clickup_list_workspaces').handler({}),
        (err) => { assert.ok(err.message.includes('Access denied for team')); return true; }
      );
    });
  });

  // ─── Empty result sets ────────────────────────────────────────────────────

  describe('empty result sets', () => {
    it('clickup_list_workspaces returns message for empty teams', async () => {
      mockFetch(200, { teams: [] });
      const result = await getTool('clickup_list_workspaces').handler({});
      assert.equal(result, 'No workspaces found.');
    });

    it('clickup_list_spaces returns message for empty spaces', async () => {
      mockFetch(200, { spaces: [] });
      const result = await getTool('clickup_list_spaces').handler({ teamId: '1' });
      assert.equal(result, 'No spaces found.');
    });

    it('clickup_list_folders returns message for empty folders', async () => {
      mockFetch(200, { folders: [] });
      const result = await getTool('clickup_list_folders').handler({ spaceId: 's1' });
      assert.equal(result, 'No folders found.');
    });

    it('clickup_list_lists returns message for empty lists (folderId)', async () => {
      mockFetch(200, { lists: [] });
      const result = await getTool('clickup_list_lists').handler({ folderId: 'f1' });
      assert.equal(result, 'No lists found.');
    });

    it('clickup_list_lists returns message for empty lists (spaceId)', async () => {
      mockFetch(200, { lists: [] });
      const result = await getTool('clickup_list_lists').handler({ spaceId: 's1' });
      assert.equal(result, 'No lists found.');
    });

    it('clickup_list_tasks returns message for empty tasks', async () => {
      mockFetch(200, { tasks: [] });
      const result = await getTool('clickup_list_tasks').handler({ listId: 'l1' });
      assert.equal(result, 'No tasks found.');
    });

    it('clickup_search_tasks returns message for no matches', async () => {
      mockFetch(200, { tasks: [] });
      const result = await getTool('clickup_search_tasks').handler({ teamId: '1', query: 'zzz' });
      assert.ok(result.includes('No tasks matching'));
    });

    it('clickup_list_statuses returns message for empty statuses', async () => {
      mockFetch(200, { statuses: [] });
      const result = await getTool('clickup_list_statuses').handler({ listId: 'l1' });
      assert.equal(result, 'No statuses found.');
    });
  });

  // ─── Missing required parameters ──────────────────────────────────────────

  describe('missing required parameters', () => {
    it('clickup_list_lists returns message when neither folderId nor spaceId given', async () => {
      const result = await getTool('clickup_list_lists').handler({});
      assert.equal(result, 'Provide either folderId or spaceId.');
    });
  });

  // ─── Pagination / limit params ────────────────────────────────────────────

  describe('pagination and limit', () => {
    it('clickup_list_tasks sends page=0 query param', async () => {
      const mocked = mockFetch(200, { tasks: [] });
      await getTool('clickup_list_tasks').handler({ listId: 'l1' });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('page=0'));
    });

    it('clickup_list_tasks respects custom limit by slicing results', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`, name: `Task ${i}`, status: { status: 'open' }, priority: null, assignees: []
      }));
      mockFetch(200, { tasks });
      const result = await getTool('clickup_list_tasks').handler({ listId: 'l1', limit: 3 });
      const lines = result.split('\n');
      assert.equal(lines.length, 3);
    });

    it('clickup_list_tasks defaults limit to 50', async () => {
      const tasks = Array.from({ length: 60 }, (_, i) => ({
        id: `t${i}`, name: `Task ${i}`, status: { status: 'open' }, priority: null, assignees: []
      }));
      mockFetch(200, { tasks });
      const result = await getTool('clickup_list_tasks').handler({ listId: 'l1' });
      const lines = result.split('\n');
      assert.equal(lines.length, 50);
    });

    it('clickup_search_tasks encodes query in URL', async () => {
      const mocked = mockFetch(200, { tasks: [] });
      await getTool('clickup_search_tasks').handler({ teamId: '1', query: 'hello world' });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('search=hello%20world'));
    });
  });

  // ─── Optional parameters omitted ─────────────────────────────────────────

  describe('optional parameters omitted', () => {
    it('clickup_create_task sends only name when optionals omitted', async () => {
      mockFetch(200, { id: 'new1', name: 'Minimal Task' });
      await getTool('clickup_create_task').handler({ listId: 'l1', name: 'Minimal Task' });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.name, 'Minimal Task');
      assert.equal(body.description, undefined);
      assert.equal(body.priority, undefined);
      assert.equal(body.assignees, undefined);
      assert.equal(body.due_date, undefined);
      assert.equal(body.tags, undefined);
    });

    it('clickup_update_task sends only provided fields', async () => {
      mockFetch(200, {});
      await getTool('clickup_update_task').handler({ taskId: 't1', name: 'Just Name' });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.name, 'Just Name');
      assert.equal(body.description, undefined);
      assert.equal(body.status, undefined);
      assert.equal(body.priority, undefined);
      assert.equal(body.assignees, undefined);
      assert.equal(body.due_date, undefined);
    });

    it('clickup_list_tasks omits status and assignee params when not provided', async () => {
      mockFetch(200, { tasks: [] });
      await getTool('clickup_list_tasks').handler({ listId: 'l1' });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(!url.includes('statuses'));
      assert.ok(!url.includes('assignees'));
    });
  });

  // ─── Special characters ───────────────────────────────────────────────────

  describe('special characters in input', () => {
    it('clickup_search_tasks encodes special chars in query', async () => {
      mockFetch(200, { tasks: [] });
      await getTool('clickup_search_tasks').handler({ teamId: '1', query: 'bug & fix <urgent>' });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('search=bug%20%26%20fix%20%3Curgent%3E'));
    });

    it('clickup_create_task handles special characters in name', async () => {
      mockFetch(200, { id: 'sp1', name: 'Fix "quotes" & <tags>' });
      const result = await getTool('clickup_create_task').handler({
        listId: 'l1',
        name: 'Fix "quotes" & <tags>'
      });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.name, 'Fix "quotes" & <tags>');
      assert.ok(result.includes('Fix "quotes" & <tags>'));
    });

    it('clickup_add_comment handles special characters in text', async () => {
      mockFetch(200, {});
      await getTool('clickup_add_comment').handler({ taskId: 't1', text: 'Line1\nLine2\n\n<b>bold</b>' });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.comment_text, 'Line1\nLine2\n\n<b>bold</b>');
    });

    it('clickup_list_tasks handles statuses with special characters', async () => {
      mockFetch(200, { tasks: [] });
      await getTool('clickup_list_tasks').handler({ listId: 'l1', statuses: ['in progress', 'won\'t fix'] });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('statuses[]=in%20progress'));
      assert.ok(url.includes("statuses[]=won't%20fix"));
    });
  });

  // ─── Complex input schemas ────────────────────────────────────────────────

  describe('complex input schemas', () => {
    it('clickup_create_task converts ISO date string to unix ms', async () => {
      mockFetch(200, { id: 'dt1', name: 'Dated' });
      await getTool('clickup_create_task').handler({
        listId: 'l1',
        name: 'Dated',
        dueDate: '2026-06-15'
      });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(typeof body.due_date, 'number');
      assert.ok(body.due_date > 0);
    });

    it('clickup_create_task passes numeric dueDate as-is (parsed to int)', async () => {
      mockFetch(200, { id: 'dt2', name: 'Unix' });
      await getTool('clickup_create_task').handler({
        listId: 'l1',
        name: 'Unix',
        dueDate: '1750000000000'
      });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.equal(body.due_date, 1750000000000);
    });

    it('clickup_create_task sends tags array and assignees array', async () => {
      mockFetch(200, { id: 'cx1', name: 'Complex' });
      await getTool('clickup_create_task').handler({
        listId: 'l1',
        name: 'Complex',
        tags: ['frontend', 'urgent'],
        assignees: [100, 200]
      });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.tags, ['frontend', 'urgent']);
      assert.deepEqual(body.assignees, [100, 200]);
    });

    it('clickup_update_task sends assignees object with add/rem arrays', async () => {
      mockFetch(200, {});
      await getTool('clickup_update_task').handler({
        taskId: 't1',
        assignees: { add: [101], rem: [202] }
      });
      const [, opts] = globalThis.fetch.mock.calls[0].arguments;
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.assignees, { add: [101], rem: [202] });
    });

    it('clickup_list_tasks sends multiple statuses and assignees as query params', async () => {
      mockFetch(200, { tasks: [] });
      await getTool('clickup_list_tasks').handler({
        listId: 'l1',
        statuses: ['open', 'in progress', 'review'],
        assignees: ['u1', 'u2']
      });
      const [url] = globalThis.fetch.mock.calls[0].arguments;
      assert.ok(url.includes('statuses[]=open'));
      assert.ok(url.includes('statuses[]=in%20progress'));
      assert.ok(url.includes('statuses[]=review'));
      assert.ok(url.includes('assignees[]=u1'));
      assert.ok(url.includes('assignees[]=u2'));
    });
  });

  // ─── Formatting edge cases ────────────────────────────────────────────────

  describe('formatting edge cases', () => {
    it('formatTask handles task with no priority', async () => {
      mockFetch(200, {
        tasks: [{
          id: 't-np', name: 'No Priority', status: { status: 'open' },
          priority: null, assignees: []
        }]
      });
      const result = await getTool('clickup_list_tasks').handler({ listId: 'l1' });
      assert.ok(result.includes('No Priority'));
      assert.ok(!result.includes('undefined'));
    });

    it('formatTask handles task with no assignees', async () => {
      mockFetch(200, {
        tasks: [{
          id: 't-na', name: 'Solo Task', status: { status: 'done' },
          priority: { id: '3' }, assignees: []
        }]
      });
      const result = await getTool('clickup_list_tasks').handler({ listId: 'l1' });
      assert.ok(result.includes('Solo Task'));
      // No assignee bracket should appear
      assert.ok(!result.includes('[]'));
    });

    it('clickup_get_task handles task with no description, tags, or due_date', async () => {
      mock.method(globalThis, 'fetch', async (url) => {
        if (url.includes('/comment')) {
          return { ok: true, status: 200, json: async () => ({ comments: [] }), text: async () => '{}' };
        }
        return {
          ok: true, status: 200,
          json: async () => ({
            id: 't-bare', name: 'Bare Task', status: { status: 'open' },
            priority: null, assignees: [], description: null,
            tags: [], due_date: null
          }),
          text: async () => '{}'
        };
      });
      const result = await getTool('clickup_get_task').handler({ taskId: 't-bare' });
      assert.ok(result.includes('Bare Task'));
      assert.ok(!result.includes('Description:'));
      assert.ok(!result.includes('Tags:'));
      assert.ok(!result.includes('Due:'));
    });

    it('clickup_list_statuses handles status with no color', async () => {
      mockFetch(200, {
        statuses: [{ status: 'backlog', color: null, type: 'custom' }]
      });
      const result = await getTool('clickup_list_statuses').handler({ listId: 'l1' });
      assert.ok(result.includes('backlog'));
      assert.ok(!result.includes('null'));
    });
  });
});
