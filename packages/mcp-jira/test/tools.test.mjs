/**
 * Comprehensive unit tests for mcp-jira tools
 * Tests all tools/*.mjs files and lib/client.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const TEST_CREDS = { domain: 'myorg', email: 'test@example.com', token: 'secret-token' };

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
    ctx: { credentials: TEST_CREDS, fetch },
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
  const { createClient, extractAdfText, toAdf } = await import('../lib/client.mjs');

  it('sends Basic auth header with base64(email:token)', async () => {
    const { ctx, getCall } = makeCtx({});
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('GET', '/project');
    const expected = Buffer.from('test@example.com:secret-token').toString('base64');
    assert.equal(getCall().opts.headers['Authorization'], `Basic ${expected}`);
  });

  it('sends Content-Type application/json', async () => {
    const { ctx, getCall } = makeCtx([]);
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('GET', '/project');
    assert.equal(getCall().opts.headers['Content-Type'], 'application/json');
  });

  it('sends Accept application/json', async () => {
    const { ctx, getCall } = makeCtx([]);
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('GET', '/project');
    assert.equal(getCall().opts.headers['Accept'], 'application/json');
  });

  it('builds correct REST API v3 URL', async () => {
    const { ctx, getCall } = makeCtx([]);
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('GET', '/project');
    assert.ok(getCall().url.startsWith('https://myorg.atlassian.net/rest/api/3/project'));
  });

  it('uses agile path for /rest/agile/ routes', async () => {
    const { ctx, getCall } = makeCtx({ values: [] });
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('GET', '/rest/agile/1.0/board');
    assert.ok(getCall().url.startsWith('https://myorg.atlassian.net/rest/agile/1.0/board'));
    assert.ok(!getCall().url.includes('/rest/api/3/rest/agile'));
  });

  it('serializes body as JSON for POST', async () => {
    const { ctx, getCall } = makeCtx({ id: '1', key: 'PROJ-1' });
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('POST', '/issue', { fields: { summary: 'Test' } });
    const parsed = JSON.parse(getCall().opts.body);
    assert.equal(parsed.fields.summary, 'Test');
  });

  it('omits body for GET', async () => {
    const { ctx, getCall } = makeCtx([]);
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('GET', '/project');
    assert.equal(getCall().opts.body, undefined);
  });

  it('returns {} for 204 No Content', async () => {
    const { ctx } = makeCtx({}, { ok: true, status: 204 });
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const result = await jira('PUT', '/issue/PROJ-1/assignee', { accountId: 'abc' });
    assert.deepEqual(result, {});
  });

  it('throws on non-ok response with status', async () => {
    const { ctx } = makeErrCtx(404, 'Not Found');
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => jira('GET', '/issue/PROJ-NOPE'), /Jira API 404/);
  });

  it('throws on 403 error', async () => {
    const { ctx } = makeErrCtx(403);
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => jira('GET', '/project'), /403/);
  });

  it('extractAdfText — extracts text from ADF doc', () => {
    const doc = {
      type: 'doc', version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }]
    };
    assert.equal(extractAdfText(doc), 'Hello world');
  });

  it('extractAdfText — handles null/undefined', () => {
    assert.equal(extractAdfText(null), '');
    assert.equal(extractAdfText(undefined), '');
  });

  it('extractAdfText — handles plain string', () => {
    assert.equal(extractAdfText('plain text'), 'plain text');
  });

  it('toAdf — wraps text in ADF doc structure', () => {
    const doc = toAdf('My comment');
    assert.equal(doc.type, 'doc');
    assert.equal(doc.version, 1);
    assert.equal(doc.content[0].type, 'paragraph');
    assert.equal(doc.content[0].content[0].text, 'My comment');
  });

  it('toAdf — handles empty string', () => {
    const doc = toAdf('');
    assert.equal(doc.content[0].content[0].text, '');
  });
});

// ---------------------------------------------------------------------------
// tools/list_projects.mjs
// ---------------------------------------------------------------------------

describe('tools/list_projects.mjs', async () => {
  const tool = (await import('../tools/list_projects.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.input, 'object');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /project', async () => {
    const { ctx, getCall } = makeCtx([]);
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('/rest/api/3/project'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns "No projects found." when empty', async () => {
    const { ctx } = makeCtx([]);
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No projects found.');
  });

  it('returns formatted project lines', async () => {
    const data = [
      { id: '10000', key: 'PROJ', name: 'My Project' },
      { id: '10001', key: 'BACK', name: 'Backend' },
    ];
    const { ctx } = makeCtx(data);
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('PROJ'));
    assert.ok(out.includes('My Project'));
    assert.ok(out.includes('BACK'));
    assert.ok(out.includes('[id: 10000]'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_project.mjs
// ---------------------------------------------------------------------------

describe('tools/get_project.mjs', async () => {
  const tool = (await import('../tools/get_project.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /project/:projectKey', async () => {
    const { ctx, getCall } = makeCtx({ id: '100', key: 'PROJ', name: 'Test' });
    await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(getCall().url.includes('/project/PROJ'));
  });

  it('returns project details', async () => {
    const { ctx } = makeCtx({
      id: '100', key: 'PROJ', name: 'My Project', description: 'A desc',
      projectTypeKey: 'software', lead: { displayName: 'Alice' }, url: 'https://jira.example.com'
    });
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(out.includes('PROJ'));
    assert.ok(out.includes('My Project'));
    assert.ok(out.includes('A desc'));
    assert.ok(out.includes('software'));
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('https://jira.example.com'));
  });

  it('handles missing optional fields', async () => {
    const { ctx } = makeCtx({ id: '101', key: 'MIN', name: 'Minimal' });
    const out = await tool.execute({ projectKey: 'MIN' }, ctx);
    assert.ok(out.includes('MIN'));
    assert.ok(out.includes('Minimal'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ projectKey: 'NOPE' }, ctx), /Jira API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/search_issues.mjs
// ---------------------------------------------------------------------------

describe('tools/search_issues.mjs', async () => {
  const tool = (await import('../tools/search_issues.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /search with JQL', async () => {
    const { ctx, getCall } = makeCtx({ issues: [] });
    await tool.execute({ jql: 'project = PROJ', limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/rest/api/3/search'));
    assert.ok(getCall().url.includes(encodeURIComponent('project = PROJ')));
    assert.ok(getCall().url.includes('maxResults=10'));
  });

  it('returns "No issues found." when empty', async () => {
    const { ctx } = makeCtx({ issues: [] });
    const out = await tool.execute({ jql: 'project = PROJ' }, ctx);
    assert.equal(out, 'No issues found.');
  });

  it('returns formatted issue lines', async () => {
    const data = {
      issues: [{
        key: 'PROJ-1',
        fields: {
          summary: 'Fix login bug',
          status: { name: 'In Progress' },
          assignee: { displayName: 'Bob' },
          priority: { name: 'High' },
          issuetype: { name: 'Bug' }
        }
      }]
    };
    const { ctx } = makeCtx(data);
    const out = await tool.execute({ jql: 'project = PROJ' }, ctx);
    assert.ok(out.includes('PROJ-1'));
    assert.ok(out.includes('Fix login bug'));
    assert.ok(out.includes('In Progress'));
    assert.ok(out.includes('Bob'));
    assert.ok(out.includes('High'));
    assert.ok(out.includes('Bug'));
  });

  it('defaults limit to 20', async () => {
    const { ctx, getCall } = makeCtx({ issues: [] });
    await tool.execute({ jql: 'status = Open' }, ctx);
    assert.ok(getCall().url.includes('maxResults=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_issue.mjs
// ---------------------------------------------------------------------------

describe('tools/get_issue.mjs', async () => {
  const tool = (await import('../tools/get_issue.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /issue/:issueKey with fields', async () => {
    const { ctx, getCall } = makeCtx({
      key: 'PROJ-1', fields: {
        summary: 'Test', status: { name: 'Open' }, priority: { name: 'Medium' },
        issuetype: { name: 'Task' }, created: '2024-01-01', updated: '2024-01-02',
        comment: { comments: [] }
      }
    });
    await tool.execute({ issueKey: 'PROJ-1' }, ctx);
    assert.ok(getCall().url.includes('/issue/PROJ-1'));
    assert.ok(getCall().url.includes('fields='));
  });

  it('returns issue details', async () => {
    const { ctx } = makeCtx({
      key: 'PROJ-5',
      fields: {
        summary: 'Implement feature',
        status: { name: 'Done' },
        priority: { name: 'High' },
        issuetype: { name: 'Story' },
        assignee: { displayName: 'Carol' },
        reporter: { displayName: 'Dave' },
        created: '2024-06-01',
        updated: '2024-06-15',
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Desc text' }] }] },
        comment: { comments: [] }
      }
    });
    const out = await tool.execute({ issueKey: 'PROJ-5' }, ctx);
    assert.ok(out.includes('PROJ-5'));
    assert.ok(out.includes('Implement feature'));
    assert.ok(out.includes('Done'));
    assert.ok(out.includes('High'));
    assert.ok(out.includes('Carol'));
    assert.ok(out.includes('Dave'));
    assert.ok(out.includes('Desc text'));
  });

  it('includes comments when present', async () => {
    const { ctx } = makeCtx({
      key: 'PROJ-6',
      fields: {
        summary: 'Issue with comments', status: { name: 'Open' }, priority: { name: 'Low' },
        issuetype: { name: 'Task' }, created: '2024-01-01', updated: '2024-01-02',
        comment: {
          comments: [{
            author: { displayName: 'Eve' },
            created: '2024-01-03',
            body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'LGTM' }] }] }
          }]
        }
      }
    });
    const out = await tool.execute({ issueKey: 'PROJ-6' }, ctx);
    assert.ok(out.includes('Eve'));
    assert.ok(out.includes('LGTM'));
  });

  it('handles null assignee/reporter', async () => {
    const { ctx } = makeCtx({
      key: 'PROJ-7',
      fields: {
        summary: 'Unassigned', status: { name: 'Open' }, priority: { name: 'None' },
        issuetype: { name: 'Bug' }, created: '2024-01-01', updated: '2024-01-01',
        assignee: null, reporter: null, comment: { comments: [] }
      }
    });
    const out = await tool.execute({ issueKey: 'PROJ-7' }, ctx);
    assert.ok(out.includes('PROJ-7'));
  });
});

// ---------------------------------------------------------------------------
// tools/create_issue.mjs
// ---------------------------------------------------------------------------

describe('tools/create_issue.mjs', async () => {
  const tool = (await import('../tools/create_issue.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('POSTs to /issue', async () => {
    const { ctx, getCall } = makeCtx({ key: 'PROJ-100', id: '10100' });
    await tool.execute({ projectKey: 'PROJ', summary: 'New task' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/rest/api/3/issue'));
  });

  it('sets project key and summary in fields', async () => {
    const { ctx, getCall } = makeCtx({ key: 'PROJ-101', id: '10101' });
    await tool.execute({ projectKey: 'PROJ', summary: 'My Issue' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.project.key, 'PROJ');
    assert.equal(body.fields.summary, 'My Issue');
  });

  it('defaults issueType to Task', async () => {
    const { ctx, getCall } = makeCtx({ key: 'PROJ-102', id: '10102' });
    await tool.execute({ projectKey: 'PROJ', summary: 'Task' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.issuetype.name, 'Task');
  });

  it('accepts custom issueType, priority, assignee', async () => {
    const { ctx, getCall } = makeCtx({ key: 'PROJ-103', id: '10103' });
    await tool.execute({ projectKey: 'PROJ', summary: 'Bug', issueType: 'Bug', priority: 'High', assigneeId: 'abc123' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.issuetype.name, 'Bug');
    assert.equal(body.fields.priority.name, 'High');
    assert.equal(body.fields.assignee.accountId, 'abc123');
  });

  it('converts description to ADF', async () => {
    const { ctx, getCall } = makeCtx({ key: 'PROJ-104', id: '10104' });
    await tool.execute({ projectKey: 'PROJ', summary: 'Test', description: 'Some desc' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.description.type, 'doc');
    assert.equal(body.fields.description.content[0].content[0].text, 'Some desc');
  });

  it('returns success message with issue key', async () => {
    const { ctx } = makeCtx({ key: 'PROJ-200', id: '10200' });
    const out = await tool.execute({ projectKey: 'PROJ', summary: 'Created issue' }, ctx);
    assert.ok(out.includes('PROJ-200'));
    assert.ok(out.includes('Created issue'));
  });
});

// ---------------------------------------------------------------------------
// tools/update_issue.mjs
// ---------------------------------------------------------------------------

describe('tools/update_issue.mjs', async () => {
  const tool = (await import('../tools/update_issue.mjs')).default;

  it('PUTs to /issue/:issueKey', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ issueKey: 'PROJ-10', summary: 'Updated' }, ctx);
    assert.equal(getCall().opts.method, 'PUT');
    assert.ok(getCall().url.includes('/issue/PROJ-10'));
  });

  it('sends summary in fields', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ issueKey: 'PROJ-10', summary: 'New Summary' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.summary, 'New Summary');
  });

  it('converts description to ADF', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ issueKey: 'PROJ-10', description: 'New desc' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.description.type, 'doc');
  });

  it('sets priority and assignee', async () => {
    const { ctx, getCall } = makeCtx({});
    await tool.execute({ issueKey: 'PROJ-10', priority: 'Critical', assigneeId: 'user-1' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.fields.priority.name, 'Critical');
    assert.equal(body.fields.assignee.accountId, 'user-1');
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({});
    const out = await tool.execute({ issueKey: 'PROJ-10', summary: 'X' }, ctx);
    assert.ok(out.includes('PROJ-10'));
  });
});

// ---------------------------------------------------------------------------
// tools/transition_issue.mjs
// ---------------------------------------------------------------------------

describe('tools/transition_issue.mjs', async () => {
  const tool = (await import('../tools/transition_issue.mjs')).default;

  it('fetches transitions then applies match', async () => {
    const responses = [
      { transitions: [{ id: 't1', name: 'In Progress' }, { id: 't2', name: 'Done' }] },
      {}
    ];
    const { ctx, getCalls } = makeCtx(null, { responses });
    await tool.execute({ issueKey: 'PROJ-20', transitionName: 'Done' }, ctx);
    assert.ok(getCalls()[0].url.includes('/issue/PROJ-20/transitions'));
    const body = JSON.parse(getCalls()[1].opts.body);
    assert.equal(body.transition.id, 't2');
  });

  it('is case-insensitive for transition name matching', async () => {
    const responses = [
      { transitions: [{ id: 'x1', name: 'In Progress' }] },
      {}
    ];
    const { ctx, getCalls } = makeCtx(null, { responses });
    const out = await tool.execute({ issueKey: 'PROJ-20', transitionName: 'in progress' }, ctx);
    assert.ok(out.includes('In Progress'));
    assert.ok(out.includes('PROJ-20'));
  });

  it('returns error message when transition not found', async () => {
    const responses = [{ transitions: [{ id: 't1', name: 'Open' }, { id: 't2', name: 'Done' }] }];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ issueKey: 'PROJ-20', transitionName: 'Nonexistent' }, ctx);
    assert.ok(out.includes('Nonexistent'));
    assert.ok(out.includes('Open'));
    assert.ok(out.includes('Done'));
  });

  it('returns success when transition applied', async () => {
    const responses = [
      { transitions: [{ id: 'done', name: 'Done' }] },
      {}
    ];
    const { ctx } = makeCtx(null, { responses });
    const out = await tool.execute({ issueKey: 'PROJ-20', transitionName: 'Done' }, ctx);
    assert.ok(out.includes('PROJ-20'));
    assert.ok(out.includes('Done'));
  });
});

// ---------------------------------------------------------------------------
// tools/add_comment.mjs
// ---------------------------------------------------------------------------

describe('tools/add_comment.mjs', async () => {
  const tool = (await import('../tools/add_comment.mjs')).default;

  it('POSTs to /issue/:issueKey/comment', async () => {
    const { ctx, getCall } = makeCtx({ id: 'cmt1' });
    await tool.execute({ issueKey: 'PROJ-30', body: 'Nice fix!' }, ctx);
    assert.equal(getCall().opts.method, 'POST');
    assert.ok(getCall().url.includes('/issue/PROJ-30/comment'));
  });

  it('sends comment body as ADF', async () => {
    const { ctx, getCall } = makeCtx({ id: 'cmt2' });
    await tool.execute({ issueKey: 'PROJ-30', body: 'Comment text' }, ctx);
    const reqBody = JSON.parse(getCall().opts.body);
    assert.equal(reqBody.body.type, 'doc');
    assert.equal(reqBody.body.content[0].content[0].text, 'Comment text');
  });

  it('returns success message with issue key', async () => {
    const { ctx } = makeCtx({});
    const out = await tool.execute({ issueKey: 'PROJ-30', body: 'Done!' }, ctx);
    assert.ok(out.includes('PROJ-30'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => tool.execute({ issueKey: 'PROJ-30', body: 'X' }, ctx), /Jira API 403/);
  });
});

// ---------------------------------------------------------------------------
// tools/assign_issue.mjs
// ---------------------------------------------------------------------------

describe('tools/assign_issue.mjs', async () => {
  const tool = (await import('../tools/assign_issue.mjs')).default;

  it('PUTs to /issue/:issueKey/assignee', async () => {
    const { ctx, getCall } = makeCtx({}, { status: 204 });
    await tool.execute({ issueKey: 'PROJ-40', assigneeId: 'user-abc' }, ctx);
    assert.equal(getCall().opts.method, 'PUT');
    assert.ok(getCall().url.includes('/issue/PROJ-40/assignee'));
  });

  it('sends accountId in body', async () => {
    const { ctx, getCall } = makeCtx({}, { status: 204 });
    await tool.execute({ issueKey: 'PROJ-40', assigneeId: 'user-abc' }, ctx);
    const body = JSON.parse(getCall().opts.body);
    assert.equal(body.accountId, 'user-abc');
  });

  it('returns success message', async () => {
    const { ctx } = makeCtx({}, { status: 204 });
    const out = await tool.execute({ issueKey: 'PROJ-40', assigneeId: 'user-abc' }, ctx);
    assert.ok(out.includes('PROJ-40'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ issueKey: 'BAD-1', assigneeId: 'x' }, ctx), /Jira API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_boards.mjs
// ---------------------------------------------------------------------------

describe('tools/list_boards.mjs', async () => {
  const tool = (await import('../tools/list_boards.mjs')).default;

  it('GETs /rest/agile/1.0/board', async () => {
    const { ctx, getCall } = makeCtx({ values: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('/rest/agile/1.0/board'));
    assert.ok(!getCall().url.includes('projectKeyOrId'));
  });

  it('filters by projectKey when provided', async () => {
    const { ctx, getCall } = makeCtx({ values: [] });
    await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(getCall().url.includes('projectKeyOrId=PROJ'));
  });

  it('returns "No boards found." when empty', async () => {
    const { ctx } = makeCtx({ values: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No boards found.');
  });

  it('returns formatted board lines', async () => {
    const { ctx } = makeCtx({ values: [{ id: 1, name: 'PROJ board', type: 'scrum' }] });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('PROJ board'));
    assert.ok(out.includes('scrum'));
    assert.ok(out.includes('[id: 1]'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_sprints.mjs
// ---------------------------------------------------------------------------

describe('tools/list_sprints.mjs', async () => {
  const tool = (await import('../tools/list_sprints.mjs')).default;

  it('GETs /rest/agile/1.0/board/:boardId/sprint', async () => {
    const { ctx, getCall } = makeCtx({ values: [] });
    await tool.execute({ boardId: '42' }, ctx);
    assert.ok(getCall().url.includes('/rest/agile/1.0/board/42/sprint'));
  });

  it('returns "No sprints found." when empty', async () => {
    const { ctx } = makeCtx({ values: [] });
    const out = await tool.execute({ boardId: '42' }, ctx);
    assert.equal(out, 'No sprints found.');
  });

  it('returns formatted sprint lines', async () => {
    const { ctx } = makeCtx({
      values: [{
        id: 10, name: 'Sprint 1', state: 'active',
        startDate: '2025-01-01', endDate: '2025-01-14'
      }]
    });
    const out = await tool.execute({ boardId: '42' }, ctx);
    assert.ok(out.includes('Sprint 1'));
    assert.ok(out.includes('active'));
    assert.ok(out.includes('2025-01-01'));
    assert.ok(out.includes('2025-01-14'));
  });

  it('handles missing dates gracefully', async () => {
    const { ctx } = makeCtx({ values: [{ id: 11, name: 'Sprint X', state: 'future' }] });
    const out = await tool.execute({ boardId: '5' }, ctx);
    assert.ok(out.includes('Sprint X'));
    assert.ok(out.includes('?'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_statuses.mjs
// ---------------------------------------------------------------------------

describe('tools/list_statuses.mjs', async () => {
  const tool = (await import('../tools/list_statuses.mjs')).default;

  it('GETs /project/:projectKey/statuses', async () => {
    const { ctx, getCall } = makeCtx([]);
    await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(getCall().url.includes('/project/PROJ/statuses'));
  });

  it('returns "No statuses found." when empty', async () => {
    const { ctx } = makeCtx([]);
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.equal(out, 'No statuses found.');
  });

  it('returns grouped statuses by issue type', async () => {
    const { ctx } = makeCtx([{
      name: 'Bug',
      statuses: [
        { id: 's1', name: 'Open' },
        { id: 's2', name: 'Resolved' },
      ]
    }]);
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(out.includes('Bug'));
    assert.ok(out.includes('Open'));
    assert.ok(out.includes('Resolved'));
    assert.ok(out.includes('[id: s1]'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_issue_types.mjs
// ---------------------------------------------------------------------------

describe('tools/list_issue_types.mjs', async () => {
  const tool = (await import('../tools/list_issue_types.mjs')).default;

  it('GETs /project/:projectKey', async () => {
    const { ctx, getCall } = makeCtx({ issueTypes: [] });
    await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(getCall().url.includes('/project/PROJ'));
  });

  it('returns "No issue types found." when empty', async () => {
    const { ctx } = makeCtx({ issueTypes: [] });
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.equal(out, 'No issue types found.');
  });

  it('returns formatted issue type lines', async () => {
    const { ctx } = makeCtx({
      issueTypes: [
        { id: 'it1', name: 'Story', subtask: false, description: 'User story' },
        { id: 'it2', name: 'Subtask', subtask: true, description: 'A subtask' },
      ]
    });
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(out.includes('Story'));
    assert.ok(out.includes('User story'));
    assert.ok(out.includes('Subtask'));
    assert.ok(out.includes('(subtask)'));
    assert.ok(out.includes('[id: it1]'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_users.mjs
// ---------------------------------------------------------------------------

describe('tools/list_users.mjs', async () => {
  const tool = (await import('../tools/list_users.mjs')).default;

  it('GETs /user/assignable/search?project=:key', async () => {
    const { ctx, getCall } = makeCtx([]);
    await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(getCall().url.includes('/user/assignable/search'));
    assert.ok(getCall().url.includes('project=PROJ'));
  });

  it('returns "No assignable users found." when empty', async () => {
    const { ctx } = makeCtx([]);
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.equal(out, 'No assignable users found.');
  });

  it('returns formatted user lines', async () => {
    const { ctx } = makeCtx([
      { accountId: 'u1', displayName: 'Alice', emailAddress: 'alice@ex.com' },
      { accountId: 'u2', displayName: 'Bob', emailAddress: null },
    ]);
    const out = await tool.execute({ projectKey: 'PROJ' }, ctx);
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('alice@ex.com'));
    assert.ok(out.includes('Bob'));
    assert.ok(out.includes('no email'));
    assert.ok(out.includes('[id: u1]'));
  });
});

// ---------------------------------------------------------------------------
// tools/my_issues.mjs
// ---------------------------------------------------------------------------

describe('tools/my_issues.mjs', async () => {
  const tool = (await import('../tools/my_issues.mjs')).default;

  it('GETs /search with currentUser JQL', async () => {
    const { ctx, getCall } = makeCtx({ issues: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/search'));
    assert.ok(getCall().url.includes('currentUser'));
  });

  it('returns "No issues assigned to you." when empty', async () => {
    const { ctx } = makeCtx({ issues: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No issues assigned to you.');
  });

  it('returns formatted issue lines', async () => {
    const { ctx } = makeCtx({
      issues: [{
        key: 'PROJ-99',
        fields: {
          summary: 'My task',
          status: { name: 'In Progress' },
          priority: { name: 'High' },
          issuetype: { name: 'Task' }
        }
      }]
    });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('PROJ-99'));
    assert.ok(out.includes('My task'));
    assert.ok(out.includes('In Progress'));
    assert.ok(out.includes('High'));
  });

  it('includes maxResults in URL', async () => {
    const { ctx, getCall } = makeCtx({ issues: [] });
    await tool.execute({ limit: 15 }, ctx);
    assert.ok(getCall().url.includes('maxResults=15'));
  });
});
