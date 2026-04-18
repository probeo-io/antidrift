/**
 * Comprehensive unit tests for mcp-clickup tools and lib/client.mjs
 * Uses Node.js built-in test runner (node:test) with mocked ctx pattern.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, priorityEmoji, formatTask } from '../lib/client.mjs';

// ─── Tool imports ────────────────────────────────────────────────────────────
import addComment from '../tools/add_comment.mjs';
import createTask from '../tools/create_task.mjs';
import getTask from '../tools/get_task.mjs';
import listFolders from '../tools/list_folders.mjs';
import listLists from '../tools/list_lists.mjs';
import listSpaces from '../tools/list_spaces.mjs';
import listStatuses from '../tools/list_statuses.mjs';
import listTasks from '../tools/list_tasks.mjs';
import listWorkspaces from '../tools/list_workspaces.mjs';
import moveTask from '../tools/move_task.mjs';
import searchTasks from '../tools/search_tasks.mjs';
import updateTask from '../tools/update_task.mjs';

// ─── Mock helper ─────────────────────────────────────────────────────────────
function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200, responses } = opts;
  let callIndex = 0;
  let capturedUrl, capturedOpts;
  const allCalls = [];
  const fetch = async (url, reqOpts) => {
    capturedUrl = url;
    capturedOpts = reqOpts;
    allCalls.push({ url, opts: reqOpts });
    let data = responseData;
    if (responses && responses[callIndex] !== undefined) {
      data = responses[callIndex];
    }
    callIndex++;
    const resolvedOk = ok;
    const resolvedStatus = status;
    return {
      ok: resolvedOk,
      status: resolvedStatus,
      text: async () => JSON.stringify(data),
      json: async () => data,
    };
  };
  return {
    ctx: { credentials: { apiToken: 'test-token' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts }),
    getAllCalls: () => allCalls,
  };
}

function makeErrCtx(status) {
  const fetch = async () => ({
    ok: false,
    status,
    text: async () => `Error ${status}`,
    json: async () => ({ err: `Error ${status}` }),
  });
  return { ctx: { credentials: { apiToken: 'test-token' }, fetch } };
}

// ─── lib/client.mjs ──────────────────────────────────────────────────────────
describe('createClient', () => {
  it('routes through provided fetchFn with correct URL prefix', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ teams: [] }), text: async () => '{}' };
    };
    const { clickup } = createClient({ apiToken: 'tok-123' }, mockFetch);
    await clickup('GET', '/team');
    assert.ok(captured.url.startsWith('https://api.clickup.com/api/v2'));
    assert.ok(captured.url.endsWith('/team'));
  });

  it('sends Authorization header with apiToken (no Bearer prefix)', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { clickup } = createClient({ apiToken: 'pk_abc123' }, mockFetch);
    await clickup('GET', '/team');
    assert.equal(captured.opts.headers['Authorization'], 'pk_abc123');
  });

  it('sends Content-Type application/json', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { clickup } = createClient({ apiToken: 'tok' }, mockFetch);
    await clickup('POST', '/task/t1/comment', { comment_text: 'hi' });
    assert.equal(captured.opts.headers['Content-Type'], 'application/json');
  });

  it('serializes body as JSON string for POST', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { clickup } = createClient({ apiToken: 'tok' }, mockFetch);
    await clickup('POST', '/list/l1/task', { name: 'My Task', priority: 2 });
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.name, 'My Task');
    assert.equal(body.priority, 2);
  });

  it('does not include body for GET requests', async () => {
    let captured;
    const mockFetch = async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { clickup } = createClient({ apiToken: 'tok' }, mockFetch);
    await clickup('GET', '/team');
    assert.equal(captured.opts.body, undefined);
  });

  it('throws with status code on non-ok response', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
      json: async () => ({}),
    });
    const { clickup } = createClient({ apiToken: 'tok' }, mockFetch);
    await assert.rejects(
      () => clickup('GET', '/task/no-such'),
      (err) => {
        assert.ok(err.message.includes('404'));
        return true;
      }
    );
  });

  it('throws with status 401 for unauthorized', async () => {
    const mockFetch = async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({}),
    });
    const { clickup } = createClient({ apiToken: 'bad-token' }, mockFetch);
    await assert.rejects(
      () => clickup('GET', '/team'),
      (err) => { assert.ok(err.message.includes('401')); return true; }
    );
  });

  it('throws with status 500 for server error', async () => {
    const mockFetch = async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({}),
    });
    const { clickup } = createClient({ apiToken: 'tok' }, mockFetch);
    await assert.rejects(
      () => clickup('DELETE', '/task/t1'),
      (err) => { assert.ok(err.message.includes('500')); return true; }
    );
  });

  it('error message includes response body text', async () => {
    const mockFetch = async () => ({
      ok: false, status: 403,
      text: async () => 'Access denied for this team',
      json: async () => ({}),
    });
    const { clickup } = createClient({ apiToken: 'tok' }, mockFetch);
    await assert.rejects(
      () => clickup('GET', '/team'),
      (err) => {
        assert.ok(err.message.includes('Access denied for this team'));
        return true;
      }
    );
  });
});

describe('priorityEmoji', () => {
  it('returns red circle for priority 1 (urgent)', () => {
    assert.equal(priorityEmoji(1), '🔴');
  });
  it('returns orange circle for priority 2 (high)', () => {
    assert.equal(priorityEmoji(2), '🟠');
  });
  it('returns yellow circle for priority 3 (normal)', () => {
    assert.equal(priorityEmoji(3), '🟡');
  });
  it('returns blue circle for priority 4 (low)', () => {
    assert.equal(priorityEmoji(4), '🔵');
  });
  it('returns white square for null/unknown priority', () => {
    assert.equal(priorityEmoji(null), '⬜');
    assert.equal(priorityEmoji(undefined), '⬜');
    assert.equal(priorityEmoji(0), '⬜');
  });
});

describe('formatTask', () => {
  it('formats task name with status and id', () => {
    const result = formatTask({
      id: 't1', name: 'Fix bug',
      status: { status: 'open' },
      priority: { id: '2' },
      assignees: [],
    });
    assert.ok(result.includes('Fix bug'));
    assert.ok(result.includes('open'));
    assert.ok(result.includes('[id: t1]'));
  });

  it('includes assignees when present', () => {
    const result = formatTask({
      id: 't2', name: 'Task',
      status: { status: 'done' },
      priority: null,
      assignees: [{ username: 'alice' }, { username: 'bob' }],
    });
    assert.ok(result.includes('[alice, bob]'));
  });

  it('omits assignee bracket when no assignees', () => {
    const result = formatTask({
      id: 't3', name: 'Solo',
      status: { status: 'done' },
      priority: null,
      assignees: [],
    });
    assert.ok(!result.includes('[]'));
  });

  it('falls back to email when username missing', () => {
    const result = formatTask({
      id: 't4', name: 'Task',
      status: { status: 'open' },
      priority: null,
      assignees: [{ email: 'dev@example.com' }],
    });
    assert.ok(result.includes('dev@example.com'));
  });
});

// ─── Tool structure: description / input / execute ───────────────────────────
const allTools = [
  { name: 'add_comment', tool: addComment },
  { name: 'create_task', tool: createTask },
  { name: 'get_task', tool: getTask },
  { name: 'list_folders', tool: listFolders },
  { name: 'list_lists', tool: listLists },
  { name: 'list_spaces', tool: listSpaces },
  { name: 'list_statuses', tool: listStatuses },
  { name: 'list_tasks', tool: listTasks },
  { name: 'list_workspaces', tool: listWorkspaces },
  { name: 'move_task', tool: moveTask },
  { name: 'search_tasks', tool: searchTasks },
  { name: 'update_task', tool: updateTask },
];

describe('tool structure', () => {
  for (const { name, tool } of allTools) {
    it(`${name} has a non-empty string description`, () => {
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.description.length > 0);
    });

    it(`${name} has an input object`, () => {
      assert.equal(typeof tool.input, 'object');
      assert.notEqual(tool.input, null);
    });

    it(`${name} has an execute function`, () => {
      assert.equal(typeof tool.execute, 'function');
    });
  }
});

// ─── add_comment ─────────────────────────────────────────────────────────────
describe('add_comment', () => {
  it('POSTs comment_text to /task/{id}/comment', async () => {
    const { ctx, getCaptured } = makeCtx({});
    const result = await addComment.execute({ taskId: 'abc123', text: 'LGTM!' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/task/abc123/comment'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.comment_text, 'LGTM!');
  });

  it('returns success message with task ID', async () => {
    const { ctx } = makeCtx({});
    const result = await addComment.execute({ taskId: 'task99', text: 'Done' }, ctx);
    assert.ok(result.includes('task99'));
    assert.ok(result.toLowerCase().includes('comment'));
  });

  it('handles multiline comment text', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await addComment.execute({ taskId: 'tx', text: 'Line1\nLine2\nLine3' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.comment_text, 'Line1\nLine2\nLine3');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => addComment.execute({ taskId: 'tx', text: 'hi' }, ctx));
  });
});

// ─── create_task ─────────────────────────────────────────────────────────────
describe('create_task', () => {
  it('POSTs task name to /list/{id}/task', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'new1', name: 'My Task' });
    await createTask.execute({ listId: 'l1', name: 'My Task' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/list/l1/task'));
    assert.equal(opts.method, 'POST');
    const body = JSON.parse(opts.body);
    assert.equal(body.name, 'My Task');
  });

  it('returns success message with task name and ID', async () => {
    const { ctx } = makeCtx({ id: 'new2', name: 'Launch Feature' });
    const result = await createTask.execute({ listId: 'l1', name: 'Launch Feature' }, ctx);
    assert.ok(result.includes('Launch Feature'));
    assert.ok(result.includes('new2'));
  });

  it('includes optional description, priority, tags, assignees in body', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'new3', name: 'Full Task' });
    await createTask.execute({
      listId: 'l1', name: 'Full Task',
      description: 'Details here',
      priority: 2,
      tags: ['urgent', 'frontend'],
      assignees: [101, 202],
    }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.description, 'Details here');
    assert.equal(body.priority, 2);
    assert.deepEqual(body.tags, ['urgent', 'frontend']);
    assert.deepEqual(body.assignees, [101, 202]);
  });

  it('omits optional fields when not provided', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'min1', name: 'Minimal' });
    await createTask.execute({ listId: 'l1', name: 'Minimal' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.description, undefined);
    assert.equal(body.priority, undefined);
    assert.equal(body.assignees, undefined);
    assert.equal(body.tags, undefined);
    assert.equal(body.due_date, undefined);
  });

  it('converts ISO date string to unix ms', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'd1', name: 'Dated' });
    await createTask.execute({ listId: 'l1', name: 'Dated', dueDate: '2026-06-01' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(typeof body.due_date, 'number');
    assert.ok(body.due_date > 0);
  });

  it('passes unix ms dueDate as integer', async () => {
    const { ctx, getCaptured } = makeCtx({ id: 'd2', name: 'Unix' });
    await createTask.execute({ listId: 'l1', name: 'Unix', dueDate: '1750000000000' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.due_date, 1750000000000);
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(422);
    await assert.rejects(() => createTask.execute({ listId: 'l1', name: 'Fail' }, ctx));
  });
});

// ─── get_task ─────────────────────────────────────────────────────────────────
describe('get_task', () => {
  it('GETs /task/{id} and returns task name and status', async () => {
    const { ctx, getAllCalls } = makeCtx(null, {
      responses: [
        { id: 't1', name: 'Fix Bug', status: { status: 'open' }, priority: { id: '2' }, assignees: [] },
        { comments: [] },
      ],
    });
    const result = await getTask.execute({ taskId: 't1' }, ctx);
    assert.ok(result.includes('Fix Bug'));
    assert.ok(result.includes('open'));
    assert.ok(result.includes('[id: t1]'));
    const calls = getAllCalls();
    assert.ok(calls[0].url.includes('/task/t1'));
    assert.equal(calls[0].opts.method, 'GET');
  });

  it('includes description, assignees, due date, and tags when present', async () => {
    const { ctx } = makeCtx(null, {
      responses: [
        {
          id: 't2', name: 'Feature',
          status: { status: 'in progress' },
          priority: { id: '1' },
          assignees: [{ username: 'dev' }],
          description: 'Build the thing',
          due_date: '1750000000000',
          tags: [{ name: 'frontend' }, { name: 'urgent' }],
        },
        { comments: [] },
      ],
    });
    const result = await getTask.execute({ taskId: 't2' }, ctx);
    assert.ok(result.includes('Description: Build the thing'));
    assert.ok(result.includes('Assignees: dev'));
    assert.ok(result.includes('Tags: frontend, urgent'));
    assert.ok(result.includes('Due:'));
  });

  it('appends comments when present', async () => {
    const { ctx } = makeCtx(null, {
      responses: [
        { id: 't3', name: 'Task', status: { status: 'done' }, priority: null, assignees: [] },
        {
          comments: [
            { user: { username: 'alice' }, comment_text: 'Looks good', date: '1711900000000' },
          ],
        },
      ],
    });
    const result = await getTask.execute({ taskId: 't3' }, ctx);
    assert.ok(result.includes('Comments:'));
    assert.ok(result.includes('alice'));
    assert.ok(result.includes('Looks good'));
  });

  it('omits Comments section when no comments', async () => {
    const { ctx } = makeCtx(null, {
      responses: [
        { id: 't4', name: 'Quiet', status: { status: 'done' }, priority: null, assignees: [] },
        { comments: [] },
      ],
    });
    const result = await getTask.execute({ taskId: 't4' }, ctx);
    assert.ok(!result.includes('Comments:'));
  });

  it('omits optional fields when absent from task', async () => {
    const { ctx } = makeCtx(null, {
      responses: [
        { id: 't5', name: 'Bare', status: { status: 'open' }, priority: null, assignees: [], description: null, tags: null, due_date: null },
        { comments: [] },
      ],
    });
    const result = await getTask.execute({ taskId: 't5' }, ctx);
    assert.ok(!result.includes('Description:'));
    assert.ok(!result.includes('Tags:'));
    assert.ok(!result.includes('Due:'));
  });
});

// ─── list_folders ─────────────────────────────────────────────────────────────
describe('list_folders', () => {
  it('GETs /space/{id}/folder', async () => {
    const { ctx, getCaptured } = makeCtx({ folders: [] });
    await listFolders.execute({ spaceId: 's1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/space/s1/folder'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted folder list with IDs', async () => {
    const { ctx } = makeCtx({ folders: [{ id: 'f1', name: 'Engineering' }, { id: 'f2', name: 'Design' }] });
    const result = await listFolders.execute({ spaceId: 's1' }, ctx);
    assert.ok(result.includes('Engineering'));
    assert.ok(result.includes('[id: f1]'));
    assert.ok(result.includes('Design'));
    assert.ok(result.includes('[id: f2]'));
  });

  it('returns message when no folders found', async () => {
    const { ctx } = makeCtx({ folders: [] });
    const result = await listFolders.execute({ spaceId: 's1' }, ctx);
    assert.equal(result, 'No folders found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listFolders.execute({ spaceId: 'bad' }, ctx));
  });
});

// ─── list_lists ───────────────────────────────────────────────────────────────
describe('list_lists', () => {
  it('GETs /folder/{id}/list when folderId given', async () => {
    const { ctx, getCaptured } = makeCtx({ lists: [] });
    await listLists.execute({ folderId: 'f1' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/folder/f1/list'));
  });

  it('GETs /space/{id}/list when spaceId given', async () => {
    const { ctx, getCaptured } = makeCtx({ lists: [] });
    await listLists.execute({ spaceId: 's1' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/space/s1/list'));
  });

  it('returns message when neither folderId nor spaceId given', async () => {
    const { ctx } = makeCtx({ lists: [] });
    const result = await listLists.execute({}, ctx);
    assert.equal(result, 'Provide either folderId or spaceId.');
  });

  it('returns formatted list names with IDs', async () => {
    const { ctx } = makeCtx({ lists: [{ id: 'l1', name: 'Backlog' }, { id: 'l2', name: 'Sprint' }] });
    const result = await listLists.execute({ folderId: 'f1' }, ctx);
    assert.ok(result.includes('Backlog'));
    assert.ok(result.includes('[id: l1]'));
    assert.ok(result.includes('Sprint'));
  });

  it('returns message when no lists found', async () => {
    const { ctx } = makeCtx({ lists: [] });
    const result = await listLists.execute({ folderId: 'f1' }, ctx);
    assert.equal(result, 'No lists found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(500);
    await assert.rejects(() => listLists.execute({ folderId: 'f1' }, ctx));
  });
});

// ─── list_spaces ──────────────────────────────────────────────────────────────
describe('list_spaces', () => {
  it('GETs /team/{id}/space', async () => {
    const { ctx, getCaptured } = makeCtx({ spaces: [] });
    await listSpaces.execute({ teamId: 'team1' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/team/team1/space'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted space names with IDs', async () => {
    const { ctx } = makeCtx({ spaces: [{ id: 'sp1', name: 'Engineering' }, { id: 'sp2', name: 'Marketing' }] });
    const result = await listSpaces.execute({ teamId: 'team1' }, ctx);
    assert.ok(result.includes('Engineering'));
    assert.ok(result.includes('[id: sp1]'));
    assert.ok(result.includes('Marketing'));
  });

  it('returns message when no spaces found', async () => {
    const { ctx } = makeCtx({ spaces: [] });
    const result = await listSpaces.execute({ teamId: 'team1' }, ctx);
    assert.equal(result, 'No spaces found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401);
    await assert.rejects(() => listSpaces.execute({ teamId: 'team1' }, ctx));
  });
});

// ─── list_statuses ────────────────────────────────────────────────────────────
describe('list_statuses', () => {
  it('GETs /list/{id}', async () => {
    const { ctx, getCaptured } = makeCtx({ statuses: [] });
    await listStatuses.execute({ listId: 'l99' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/list/l99'));
    assert.ok(!url.includes('/task'));
  });

  it('returns formatted statuses with color and type', async () => {
    const { ctx } = makeCtx({
      statuses: [
        { status: 'open', color: '#ffffff', type: 'open' },
        { status: 'in progress', color: '#0000ff', type: 'custom' },
        { status: 'done', color: '#00ff00', type: 'closed' },
      ],
    });
    const result = await listStatuses.execute({ listId: 'l1' }, ctx);
    assert.ok(result.includes('open'));
    assert.ok(result.includes('#ffffff'));
    assert.ok(result.includes('in progress'));
    assert.ok(result.includes('[type: custom]'));
    assert.ok(result.includes('done'));
  });

  it('omits color when null', async () => {
    const { ctx } = makeCtx({ statuses: [{ status: 'backlog', color: null, type: 'custom' }] });
    const result = await listStatuses.execute({ listId: 'l1' }, ctx);
    assert.ok(result.includes('backlog'));
    assert.ok(!result.includes('null'));
  });

  it('returns message when no statuses', async () => {
    const { ctx } = makeCtx({ statuses: [] });
    const result = await listStatuses.execute({ listId: 'l1' }, ctx);
    assert.equal(result, 'No statuses found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => listStatuses.execute({ listId: 'no-list' }, ctx));
  });
});

// ─── list_tasks ───────────────────────────────────────────────────────────────
describe('list_tasks', () => {
  it('GETs /list/{id}/task with page=0', async () => {
    const { ctx, getCaptured } = makeCtx({ tasks: [] });
    await listTasks.execute({ listId: 'l1' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('/list/l1/task'));
    assert.ok(url.includes('page=0'));
  });

  it('returns formatted tasks with priority emoji and IDs', async () => {
    const { ctx } = makeCtx({
      tasks: [
        { id: 't1', name: 'Fix bug', status: { status: 'open' }, priority: { id: '1' }, assignees: [] },
        { id: 't2', name: 'Add feature', status: { status: 'done' }, priority: { id: '4' }, assignees: [{ username: 'dev' }] },
      ],
    });
    const result = await listTasks.execute({ listId: 'l1' }, ctx);
    assert.ok(result.includes('Fix bug'));
    assert.ok(result.includes('[id: t1]'));
    assert.ok(result.includes('Add feature'));
    assert.ok(result.includes('[id: t2]'));
  });

  it('appends statuses[] query params', async () => {
    const { ctx, getCaptured } = makeCtx({ tasks: [] });
    await listTasks.execute({ listId: 'l1', statuses: ['open', 'in progress'] }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('statuses[]=open'));
    assert.ok(url.includes('statuses[]=in%20progress'));
  });

  it('appends assignees[] query params', async () => {
    const { ctx, getCaptured } = makeCtx({ tasks: [] });
    await listTasks.execute({ listId: 'l1', assignees: ['u1', 'u2'] }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('assignees[]=u1'));
    assert.ok(url.includes('assignees[]=u2'));
  });

  it('respects custom limit by slicing results', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`, name: `Task ${i}`, status: { status: 'open' }, priority: null, assignees: [],
    }));
    const { ctx } = makeCtx({ tasks });
    const result = await listTasks.execute({ listId: 'l1', limit: 3 }, ctx);
    assert.equal(result.trim().split('\n').length, 3);
  });

  it('defaults to limit 50', async () => {
    const tasks = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`, name: `Task ${i}`, status: { status: 'open' }, priority: null, assignees: [],
    }));
    const { ctx } = makeCtx({ tasks });
    const result = await listTasks.execute({ listId: 'l1' }, ctx);
    assert.equal(result.trim().split('\n').length, 50);
  });

  it('returns message when no tasks found', async () => {
    const { ctx } = makeCtx({ tasks: [] });
    const result = await listTasks.execute({ listId: 'l1' }, ctx);
    assert.equal(result, 'No tasks found.');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(500);
    await assert.rejects(() => listTasks.execute({ listId: 'l1' }, ctx));
  });
});

// ─── list_workspaces ──────────────────────────────────────────────────────────
describe('list_workspaces', () => {
  it('GETs /team', async () => {
    const { ctx, getCaptured } = makeCtx({ teams: [] });
    await listWorkspaces.execute({}, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.endsWith('/team'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted workspace names with IDs', async () => {
    const { ctx } = makeCtx({ teams: [{ id: '123', name: 'Acme' }, { id: '456', name: 'Beta' }] });
    const result = await listWorkspaces.execute({}, ctx);
    assert.ok(result.includes('Acme'));
    assert.ok(result.includes('[id: 123]'));
    assert.ok(result.includes('Beta'));
    assert.ok(result.includes('[id: 456]'));
  });

  it('returns message when no workspaces found', async () => {
    const { ctx } = makeCtx({ teams: [] });
    const result = await listWorkspaces.execute({}, ctx);
    assert.equal(result, 'No workspaces found.');
  });

  it('sends correct Authorization header', async () => {
    const { ctx, getCaptured } = makeCtx({ teams: [] });
    await listWorkspaces.execute({}, ctx);
    const { opts } = getCaptured();
    assert.equal(opts.headers['Authorization'], 'test-token');
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(401);
    await assert.rejects(() => listWorkspaces.execute({}, ctx));
  });
});

// ─── move_task ────────────────────────────────────────────────────────────────
describe('move_task', () => {
  it('PUTs status to /task/{id}', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await moveTask.execute({ taskId: 't1', status: 'done' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/task/t1'));
    assert.equal(opts.method, 'PUT');
    const body = JSON.parse(opts.body);
    assert.equal(body.status, 'done');
  });

  it('returns success message with task ID and new status', async () => {
    const { ctx } = makeCtx({});
    const result = await moveTask.execute({ taskId: 'task42', status: 'in review' }, ctx);
    assert.ok(result.includes('task42'));
    assert.ok(result.includes('in review'));
  });

  it('works for various status names', async () => {
    for (const status of ['open', 'in progress', 'closed', 'review']) {
      const { ctx, getCaptured } = makeCtx({});
      await moveTask.execute({ taskId: 'tx', status }, ctx);
      const { opts } = getCaptured();
      const body = JSON.parse(opts.body);
      assert.equal(body.status, status);
    }
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => moveTask.execute({ taskId: 'bad', status: 'done' }, ctx));
  });
});

// ─── search_tasks ─────────────────────────────────────────────────────────────
describe('search_tasks', () => {
  it('GETs /team/{id}/task?search=...', async () => {
    const { ctx, getCaptured } = makeCtx({ tasks: [] });
    await searchTasks.execute({ teamId: 'team1', query: 'bug fix' }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/team/team1/task'));
    assert.ok(url.includes('search=bug%20fix'));
    assert.equal(opts.method, 'GET');
  });

  it('returns formatted tasks when results found', async () => {
    const { ctx } = makeCtx({
      tasks: [
        { id: 'r1', name: 'Found Task', status: { status: 'open' }, priority: { id: '3' }, assignees: [] },
      ],
    });
    const result = await searchTasks.execute({ teamId: 'team1', query: 'found' }, ctx);
    assert.ok(result.includes('Found Task'));
    assert.ok(result.includes('[id: r1]'));
  });

  it('returns no-match message when empty results', async () => {
    const { ctx } = makeCtx({ tasks: [] });
    const result = await searchTasks.execute({ teamId: 'team1', query: 'nothinghere' }, ctx);
    assert.ok(result.includes('No tasks matching'));
    assert.ok(result.includes('nothinghere'));
  });

  it('URL-encodes special characters in query', async () => {
    const { ctx, getCaptured } = makeCtx({ tasks: [] });
    await searchTasks.execute({ teamId: 'team1', query: 'bug & fix <urgent>' }, ctx);
    const { url } = getCaptured();
    assert.ok(url.includes('search=bug%20%26%20fix%20%3Curgent%3E'));
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(500);
    await assert.rejects(() => searchTasks.execute({ teamId: 'team1', query: 'test' }, ctx));
  });
});

// ─── update_task ──────────────────────────────────────────────────────────────
describe('update_task', () => {
  it('PUTs to /task/{id} with provided fields', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await updateTask.execute({ taskId: 't1', name: 'New Name', status: 'done', priority: 1 }, ctx);
    const { url, opts } = getCaptured();
    assert.ok(url.includes('/task/t1'));
    assert.equal(opts.method, 'PUT');
    const body = JSON.parse(opts.body);
    assert.equal(body.name, 'New Name');
    assert.equal(body.status, 'done');
    assert.equal(body.priority, 1);
  });

  it('returns success message with task ID', async () => {
    const { ctx } = makeCtx({});
    const result = await updateTask.execute({ taskId: 'task77', name: 'Updated' }, ctx);
    assert.ok(result.includes('task77'));
    assert.ok(result.toLowerCase().includes('updated'));
  });

  it('only includes provided fields in body', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await updateTask.execute({ taskId: 't1', description: 'New desc' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.description, 'New desc');
    assert.equal(body.name, undefined);
    assert.equal(body.status, undefined);
    assert.equal(body.priority, undefined);
  });

  it('sends assignees object with add/rem arrays', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await updateTask.execute({ taskId: 't1', assignees: { add: [101], rem: [202] } }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.assignees, { add: [101], rem: [202] });
  });

  it('converts ISO dueDate to unix ms', async () => {
    const { ctx, getCaptured } = makeCtx({});
    await updateTask.execute({ taskId: 't1', dueDate: '2026-12-31' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(typeof body.due_date, 'number');
    assert.ok(body.due_date > 0);
  });

  it('throws on non-ok response', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => updateTask.execute({ taskId: 'bad' }, ctx));
  });
});
