import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'clickup.json');
const BACKUP_PATH = CONFIG_PATH + '.test-backup';

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
  mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

afterEach(() => {
  mock.restoreAll();
});

// ─── Handler tests ──────────────────────────────────────────────────────────

describe('clickup_list_workspaces handler', () => {
  it('returns formatted workspace names', async () => {
    mockFetch(200, {
      teams: [
        { id: '123', name: 'My Workspace' },
        { id: '456', name: 'Other Workspace' },
      ],
    });
    const tool = getTool('clickup_list_workspaces');
    const result = await tool.handler({});
    assert.ok(result.includes('My Workspace'));
    assert.ok(result.includes('Other Workspace'));
    assert.ok(result.includes('[id: 123]'));
    assert.ok(result.includes('[id: 456]'));
  });

  it('returns message when no workspaces found', async () => {
    mockFetch(200, { teams: [] });
    const tool = getTool('clickup_list_workspaces');
    const result = await tool.handler({});
    assert.equal(result, 'No workspaces found.');
  });

  it('calls correct API endpoint', async () => {
    mockFetch(200, { teams: [] });
    const tool = getTool('clickup_list_workspaces');
    await tool.handler({});
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.endsWith('/team'));
    assert.equal(opts.method, 'GET');
    assert.equal(opts.headers['Authorization'], 'test-fake-token');
  });
});

describe('clickup_list_spaces handler', () => {
  it('returns formatted space names', async () => {
    mockFetch(200, {
      spaces: [
        { id: 's1', name: 'Engineering' },
        { id: 's2', name: 'Marketing' },
      ],
    });
    const tool = getTool('clickup_list_spaces');
    const result = await tool.handler({ teamId: '123' });
    assert.ok(result.includes('Engineering'));
    assert.ok(result.includes('Marketing'));
    assert.ok(result.includes('[id: s1]'));
  });

  it('calls correct endpoint with team ID', async () => {
    mockFetch(200, { spaces: [] });
    const tool = getTool('clickup_list_spaces');
    await tool.handler({ teamId: '789' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/team/789/space'));
  });

  it('returns message when no spaces found', async () => {
    mockFetch(200, { spaces: [] });
    const tool = getTool('clickup_list_spaces');
    const result = await tool.handler({ teamId: '123' });
    assert.equal(result, 'No spaces found.');
  });
});

describe('clickup_list_tasks handler', () => {
  it('returns formatted tasks with priority emoji', async () => {
    mockFetch(200, {
      tasks: [
        {
          id: 't1',
          name: 'Fix bug',
          status: { status: 'open' },
          priority: { id: '2' },
          assignees: [{ username: 'dev' }],
          date_created: '1711900000000',
        },
        {
          id: 't2',
          name: 'Add feature',
          status: { status: 'in progress' },
          priority: { id: '1' },
          assignees: [],
          date_created: '1711900000000',
        },
      ],
    });
    const tool = getTool('clickup_list_tasks');
    const result = await tool.handler({ listId: 'l1' });
    // Priority 2 = orange emoji, priority 1 = red emoji
    assert.ok(result.includes('Fix bug'));
    assert.ok(result.includes('open'));
    assert.ok(result.includes('[dev]'));
    assert.ok(result.includes('[id: t1]'));
    assert.ok(result.includes('Add feature'));
    assert.ok(result.includes('in progress'));
  });

  it('sends statuses and assignees as query params', async () => {
    mockFetch(200, { tasks: [] });
    const tool = getTool('clickup_list_tasks');
    await tool.handler({ listId: 'l1', statuses: ['open', 'done'], assignees: ['u1'] });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/list/l1/task'));
    assert.ok(url.includes('statuses[]=open'));
    assert.ok(url.includes('statuses[]=done'));
    assert.ok(url.includes('assignees[]=u1'));
  });

  it('returns message when no tasks found', async () => {
    mockFetch(200, { tasks: [] });
    const tool = getTool('clickup_list_tasks');
    const result = await tool.handler({ listId: 'l1' });
    assert.equal(result, 'No tasks found.');
  });
});

describe('clickup_get_task handler', () => {
  it('returns task details with description and comments', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async (url) => {
      callCount++;
      // First call is GET /task/{id}, second is GET /task/{id}/comment
      if (url.includes('/comment')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comments: [
              {
                user: { username: 'alice' },
                comment_text: 'Looks good',
                date: '1711900000000',
              },
            ],
          }),
          text: async () => '{}',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 't1',
          name: 'Fix bug',
          description: 'Details about the bug',
          status: { status: 'open' },
          priority: { id: '2' },
          assignees: [{ username: 'dev' }],
        }),
        text: async () => '{}',
      };
    });
    const tool = getTool('clickup_get_task');
    const result = await tool.handler({ taskId: 't1' });
    assert.ok(result.includes('Fix bug'));
    assert.ok(result.includes('Status: open'));
    assert.ok(result.includes('Description: Details about the bug'));
    assert.ok(result.includes('Assignees: dev'));
    assert.ok(result.includes('[id: t1]'));
    assert.ok(result.includes('alice'));
    assert.ok(result.includes('Looks good'));
  });

  it('handles task with no comments', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('/comment')) {
        return {
          ok: true, status: 200,
          json: async () => ({ comments: [] }),
          text: async () => '{}',
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({
          id: 't2', name: 'Simple task',
          status: { status: 'done' }, priority: { id: '4' },
          assignees: [],
        }),
        text: async () => '{}',
      };
    });
    const tool = getTool('clickup_get_task');
    const result = await tool.handler({ taskId: 't2' });
    assert.ok(result.includes('Simple task'));
    assert.ok(!result.includes('Comments:'));
  });
});

describe('clickup_create_task handler', () => {
  it('sends correct body with name, description, priority', async () => {
    mockFetch(200, { id: 'new1', name: 'New Task' });
    const tool = getTool('clickup_create_task');
    const result = await tool.handler({
      listId: 'l1',
      name: 'New Task',
      description: 'Task description',
      priority: 2,
    });
    assert.ok(result.includes('Created task'));
    assert.ok(result.includes('New Task'));
    assert.ok(result.includes('[id: new1]'));

    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/list/l1/task'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.name, 'New Task');
    assert.equal(body.description, 'Task description');
    assert.equal(body.priority, 2);
  });

  it('sends due date as unix ms', async () => {
    mockFetch(200, { id: 'new2', name: 'Dated Task' });
    const tool = getTool('clickup_create_task');
    await tool.handler({
      listId: 'l1',
      name: 'Dated Task',
      dueDate: '2026-04-01',
    });
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    const body = JSON.parse(opts.body);
    assert.equal(typeof body.due_date, 'number');
    assert.ok(body.due_date > 0);
  });

  it('sends optional tags and assignees', async () => {
    mockFetch(200, { id: 'new3', name: 'Full Task' });
    const tool = getTool('clickup_create_task');
    await tool.handler({
      listId: 'l1',
      name: 'Full Task',
      assignees: [101, 102],
      tags: ['urgent', 'frontend'],
    });
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.assignees, [101, 102]);
    assert.deepEqual(body.tags, ['urgent', 'frontend']);
  });
});

describe('clickup_update_task handler', () => {
  it('sends updated fields to correct endpoint', async () => {
    mockFetch(200, {});
    const tool = getTool('clickup_update_task');
    const result = await tool.handler({
      taskId: 't1',
      name: 'Updated Name',
      status: 'in progress',
      priority: 1,
    });
    assert.ok(result.includes('updated'));
    assert.ok(result.includes('t1'));

    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/task/t1'));
    assert.equal(opts.method, 'PUT');
    const body = JSON.parse(opts.body);
    assert.equal(body.name, 'Updated Name');
    assert.equal(body.status, 'in progress');
    assert.equal(body.priority, 1);
  });

  it('only sends provided fields', async () => {
    mockFetch(200, {});
    const tool = getTool('clickup_update_task');
    await tool.handler({ taskId: 't1', description: 'New desc' });
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    const body = JSON.parse(opts.body);
    assert.equal(body.description, 'New desc');
    assert.equal(body.name, undefined);
    assert.equal(body.status, undefined);
  });
});

describe('clickup_add_comment handler', () => {
  it('sends comment_text to correct endpoint', async () => {
    mockFetch(200, {});
    const tool = getTool('clickup_add_comment');
    const result = await tool.handler({ taskId: 't1', text: 'Great progress!' });
    assert.ok(result.includes('Comment added'));
    assert.ok(result.includes('t1'));

    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/task/t1/comment'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.comment_text, 'Great progress!');
  });
});

describe('clickup_search_tasks handler', () => {
  it('sends search query and returns formatted results', async () => {
    mockFetch(200, {
      tasks: [
        {
          id: 't5',
          name: 'Search Result Task',
          status: { status: 'open' },
          priority: { id: '3' },
          assignees: [],
        },
      ],
    });
    const tool = getTool('clickup_search_tasks');
    const result = await tool.handler({ teamId: '123', query: 'bug fix' });
    assert.ok(result.includes('Search Result Task'));
    assert.ok(result.includes('[id: t5]'));

    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/team/123/task'));
    assert.ok(url.includes('search=bug%20fix'));
  });

  it('returns message when no results', async () => {
    mockFetch(200, { tasks: [] });
    const tool = getTool('clickup_search_tasks');
    const result = await tool.handler({ teamId: '123', query: 'nonexistent' });
    assert.ok(result.includes('No tasks matching'));
    assert.ok(result.includes('nonexistent'));
  });
});

describe('clickup_list_statuses handler', () => {
  it('returns formatted statuses with colors', async () => {
    mockFetch(200, {
      statuses: [
        { status: 'open', color: '#fff', type: 'open' },
        { status: 'in progress', color: '#00f', type: 'custom' },
        { status: 'done', color: '#0f0', type: 'closed' },
      ],
    });
    const tool = getTool('clickup_list_statuses');
    const result = await tool.handler({ listId: 'l1' });
    assert.ok(result.includes('open'));
    assert.ok(result.includes('#fff'));
    assert.ok(result.includes('in progress'));
    assert.ok(result.includes('done'));
    assert.ok(result.includes('#0f0'));
  });

  it('calls GET /list/{id}', async () => {
    mockFetch(200, { statuses: [] });
    const tool = getTool('clickup_list_statuses');
    await tool.handler({ listId: 'l99' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/list/l99'));
  });

  it('returns message when no statuses', async () => {
    mockFetch(200, { statuses: [] });
    const tool = getTool('clickup_list_statuses');
    const result = await tool.handler({ listId: 'l1' });
    assert.equal(result, 'No statuses found.');
  });
});

describe('clickup_move_task handler', () => {
  it('sends status update via PUT', async () => {
    mockFetch(200, {});
    const tool = getTool('clickup_move_task');
    const result = await tool.handler({ taskId: 't1', status: 'done' });
    assert.ok(result.includes('moved to'));
    assert.ok(result.includes('done'));
    assert.ok(result.includes('t1'));

    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/task/t1'));
    assert.equal(opts.method, 'PUT');
    const body = JSON.parse(opts.body);
    assert.equal(body.status, 'done');
  });
});

describe('clickup error handling', () => {
  it('throws on 404 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 404,
      json: async () => ({ err: 'Not Found' }),
      text: async () => 'Not Found',
    }));
    const tool = getTool('clickup_list_workspaces');
    await assert.rejects(
      () => tool.handler({}),
      (err) => {
        assert.ok(err.message.includes('404'));
        return true;
      }
    );
  });

  it('throws on 500 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 500,
      json: async () => ({ err: 'Internal Server Error' }),
      text: async () => 'Internal Server Error',
    }));
    const tool = getTool('clickup_get_task');
    await assert.rejects(
      () => tool.handler({ taskId: 't1' }),
      (err) => {
        assert.ok(err.message.includes('500'));
        return true;
      }
    );
  });
});
