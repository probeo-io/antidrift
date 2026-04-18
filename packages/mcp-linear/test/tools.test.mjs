/**
 * Comprehensive unit tests for mcp-linear zeromcp tools.
 * Tests each tools/*.mjs file's structure and execute() behavior,
 * plus lib/client.mjs directly.
 *
 * Run: node --test test/tools.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, formatIssue, formatProject } from '../lib/client.mjs';

import addComment from '../tools/add_comment.mjs';
import assignIssue from '../tools/assign_issue.mjs';
import changeStatus from '../tools/change_status.mjs';
import createIssue from '../tools/create_issue.mjs';
import currentCycle from '../tools/current_cycle.mjs';
import getIssue from '../tools/get_issue.mjs';
import getProject from '../tools/get_project.mjs';
import listProjects from '../tools/list_projects.mjs';
import listTeams from '../tools/list_teams.mjs';
import search from '../tools/search.mjs';
import searchIssues from '../tools/search_issues.mjs';
import updateIssue from '../tools/update_issue.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

/**
 * Creates a mock ctx for Linear. All calls POST to graphql endpoint.
 * responseData should be the `data` field of the GraphQL response:
 *   { data: { ... } }
 */
function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200 } = opts;
  let capturedUrl, capturedOpts;
  const fetch = async (url, reqOpts) => {
    capturedUrl = url;
    capturedOpts = reqOpts;
    return {
      ok,
      status,
      text: async () => ok ? JSON.stringify({ data: responseData }) : 'API Error',
      json: async () => ok ? { data: responseData } : { errors: [{ message: 'API Error' }] }
    };
  };
  return {
    ctx: { credentials: { apiKey: 'test-key' }, fetch },
    getCaptured: () => ({ url: capturedUrl, opts: capturedOpts })
  };
}

/**
 * Creates a mock ctx that returns different responses per sequential call.
 * Each entry in `responses` is passed as the `data` field of the GQL response.
 */
function makeMultiCtx(responses) {
  let callIndex = 0;
  const calls = [];
  const fetch = async (url, reqOpts) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    calls.push({ url, body: JSON.parse(reqOpts.body) });
    callIndex++;
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      text: async () => JSON.stringify({ data: resp.data }),
      json: async () => ({ data: resp.data })
    };
  };
  return {
    ctx: { credentials: { apiKey: 'test-key' }, fetch },
    getCalls: () => calls
  };
}

const ALL_TOOLS = [
  addComment, assignIssue, changeStatus, createIssue, currentCycle,
  getIssue, getProject, listProjects, listTeams, search, searchIssues, updateIssue
];

// ---------------------------------------------------------------------------
// Structure tests
// ---------------------------------------------------------------------------

describe('tool structure', () => {
  for (const tool of ALL_TOOLS) {
    it(`${tool.description?.slice(0, 45) || '(unknown)'} — has required exports`, () => {
      assert.equal(typeof tool.description, 'string', 'description must be a string');
      assert.ok(tool.description.length > 0, 'description must be non-empty');
      assert.equal(typeof tool.input, 'object', 'input must be an object');
      assert.ok(tool.input !== null, 'input must not be null');
      assert.equal(typeof tool.execute, 'function', 'execute must be a function');
    });
  }

  it('all tools have non-empty descriptions (>=10 chars)', () => {
    for (const tool of ALL_TOOLS) {
      assert.ok(tool.description.length >= 10, `description too short: "${tool.description}"`);
    }
  });

  it('all input properties that exist have type and description', () => {
    for (const tool of ALL_TOOLS) {
      for (const [key, prop] of Object.entries(tool.input)) {
        assert.ok(prop.type, `${tool.description.slice(0, 30)}.input.${key} missing type`);
        assert.ok(prop.description, `${tool.description.slice(0, 30)}.input.${key} missing description`);
      }
    }
  });

  it('tools that operate on issues have identifier in input', () => {
    const needIdentifier = [addComment, assignIssue, changeStatus, getIssue, updateIssue];
    for (const tool of needIdentifier) {
      assert.ok(tool.input.identifier, `${tool.description.slice(0, 30)} missing input.identifier`);
    }
  });
});

// ---------------------------------------------------------------------------
// lib/client.mjs — createClient
// ---------------------------------------------------------------------------

describe('createClient', () => {
  it('POSTs to https://api.linear.app/graphql', async () => {
    const { ctx, getCaptured } = makeCtx({ teams: { nodes: [] } });
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    await linear('{ teams { nodes { id } } }');
    const { url, opts } = getCaptured();
    assert.equal(url, LINEAR_GRAPHQL_URL);
    assert.equal(opts.method, 'POST');
  });

  it('sets Authorization header with raw api key (no Bearer prefix)', async () => {
    const { ctx, getCaptured } = makeCtx({ teams: { nodes: [] } });
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    await linear('{ teams { nodes { id } } }');
    const { opts } = getCaptured();
    assert.equal(opts.headers['Authorization'], 'test-key');
  });

  it('sets Content-Type: application/json', async () => {
    const { ctx, getCaptured } = makeCtx({ teams: { nodes: [] } });
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    await linear('{ teams { nodes { id } } }');
    const { opts } = getCaptured();
    assert.equal(opts.headers['Content-Type'], 'application/json');
  });

  it('sends query and variables in request body', async () => {
    const { ctx, getCaptured } = makeCtx({ issues: { nodes: [] } });
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const query = '{ issues { nodes { id } } }';
    const variables = { teamId: 'team-123' };
    await linear(query, variables);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.equal(body.query, query);
    assert.deepEqual(body.variables, variables);
  });

  it('uses custom fetchFn instead of global fetch', async () => {
    let wasCalled = false;
    const customFetch = async () => {
      wasCalled = true;
      return { ok: true, json: async () => ({ data: { teams: { nodes: [] } } }) };
    };
    const { linear } = createClient({ apiKey: 'key' }, customFetch);
    await linear('{ teams { nodes { id } } }');
    assert.ok(wasCalled);
  });

  it('throws on non-ok HTTP response', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(
      () => linear('{ teams { nodes { id } } }'),
      (err) => {
        assert.ok(err.message.includes('500'), `Error: ${err.message}`);
        return true;
      }
    );
  });

  it('throws on GraphQL errors array', async () => {
    const errorFetch = async () => ({
      ok: true,
      json: async () => ({ errors: [{ message: 'Field not found' }] })
    });
    const { linear } = createClient({ apiKey: 'key' }, errorFetch);
    await assert.rejects(
      () => linear('{ badField }'),
      (err) => {
        assert.ok(err.message.includes('Field not found'), `Error: ${err.message}`);
        return true;
      }
    );
  });

  it('returns data field from successful response', async () => {
    const { ctx } = makeCtx({ teams: { nodes: [{ id: 'team-1', name: 'Engineering' }] } });
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const data = await linear('{ teams { nodes { id name } } }');
    assert.ok(data.teams);
    assert.equal(data.teams.nodes[0].name, 'Engineering');
  });
});

// ---------------------------------------------------------------------------
// formatIssue and formatProject helpers
// ---------------------------------------------------------------------------

describe('formatIssue', () => {
  it('formats issue with identifier, title, state, priority, assignee', () => {
    const issue = {
      identifier: 'ENG-42',
      title: 'Fix login bug',
      state: { name: 'In Progress' },
      priority: 2,
      assignee: { name: 'Alice' }
    };
    const out = formatIssue(issue);
    assert.ok(out.includes('ENG-42'));
    assert.ok(out.includes('Fix login bug'));
    assert.ok(out.includes('In Progress'));
    assert.ok(out.includes('High'));
    assert.ok(out.includes('Alice'));
  });

  it('omits priority label for None (0)', () => {
    const issue = { identifier: 'ENG-1', title: 'T', state: { name: 'Todo' }, priority: 0 };
    const out = formatIssue(issue);
    assert.ok(!out.includes('None'));
  });

  it('handles missing optional fields', () => {
    const issue = { identifier: 'ENG-2', title: 'Minimal' };
    const out = formatIssue(issue);
    assert.ok(out.includes('ENG-2'));
    assert.ok(out.includes('Minimal'));
  });
});

describe('formatProject', () => {
  it('formats project with name, state, progress, lead', () => {
    const project = {
      name: 'Q1 Initiative',
      state: 'started',
      progress: 0.75,
      lead: { name: 'Bob' }
    };
    const out = formatProject(project);
    assert.ok(out.includes('Q1 Initiative'));
    assert.ok(out.includes('started'));
    assert.ok(out.includes('75%'));
    assert.ok(out.includes('Bob'));
  });

  it('handles missing optional fields', () => {
    const project = { name: 'Minimal Project' };
    const out = formatProject(project);
    assert.ok(out.includes('Minimal Project'));
  });

  it('rounds progress percentage', () => {
    const project = { name: 'P', progress: 0.333 };
    const out = formatProject(project);
    assert.ok(out.includes('33%'));
  });
});

// ---------------------------------------------------------------------------
// Tool: list_teams
// ---------------------------------------------------------------------------

describe('list_teams', () => {
  it('happy path — returns formatted teams', async () => {
    const { ctx, getCaptured } = makeCtx({
      teams: {
        nodes: [
          { key: 'ENG', name: 'Engineering', description: 'Core eng', issueCount: 42 },
          { key: 'PROD', name: 'Product', description: null, issueCount: 15 }
        ]
      }
    });
    const result = await listTeams.execute({}, ctx);
    assert.ok(result.includes('ENG'));
    assert.ok(result.includes('Engineering'));
    assert.ok(result.includes('42'));
    assert.ok(result.includes('PROD'));
    assert.ok(result.includes('15'));
    const { url, opts } = getCaptured();
    assert.equal(url, LINEAR_GRAPHQL_URL);
    assert.equal(opts.method, 'POST');
  });

  it('returns "No teams found." for empty nodes', async () => {
    const { ctx } = makeCtx({ teams: { nodes: [] } });
    const result = await listTeams.execute({}, ctx);
    assert.equal(result, 'No teams found.');
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 401 });
    await assert.rejects(() => listTeams.execute({}, ctx), /401/);
  });
});

// ---------------------------------------------------------------------------
// Tool: search_issues
// ---------------------------------------------------------------------------

describe('search_issues', () => {
  it('happy path — returns formatted issues', async () => {
    const { ctx, getCaptured } = makeCtx({
      issues: {
        nodes: [
          { identifier: 'ENG-1', title: 'Login bug', state: { name: 'Todo' }, priority: 2, assignee: { name: 'Alice' } },
          { identifier: 'ENG-2', title: 'Slow query', state: { name: 'In Progress' }, priority: 3, assignee: null }
        ]
      }
    });
    const result = await searchIssues.execute({ teamKey: 'ENG' }, ctx);
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Login bug'));
    assert.ok(result.includes('ENG-2'));
    assert.ok(result.includes('Slow query'));
    const { url } = getCaptured();
    assert.equal(url, LINEAR_GRAPHQL_URL);
  });

  it('returns "No issues found." for empty nodes', async () => {
    const { ctx } = makeCtx({ issues: { nodes: [] } });
    const result = await searchIssues.execute({ query: 'nonexistent' }, ctx);
    assert.equal(result, 'No issues found.');
  });

  it('includes teamKey filter in query body', async () => {
    const { ctx, getCaptured } = makeCtx({
      issues: { nodes: [{ identifier: 'ENG-5', title: 'T', state: { name: 'Todo' }, priority: 0 }] }
    });
    await searchIssues.execute({ teamKey: 'ENG', status: 'Todo' }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(body.query.includes('ENG'), `Query should reference ENG: ${body.query}`);
    assert.ok(body.query.includes('Todo'), `Query should reference Todo: ${body.query}`);
  });

  it('respects limit param', async () => {
    const { ctx, getCaptured } = makeCtx({ issues: { nodes: [] } });
    await searchIssues.execute({ query: 'test', limit: 5 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(body.query.includes('5'), `Query should include limit 5: ${body.query}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    await assert.rejects(() => searchIssues.execute({ query: 'test' }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_issue
// ---------------------------------------------------------------------------

describe('get_issue', () => {
  it('happy path — returns detailed issue info', async () => {
    const { ctx } = makeCtx({
      issues: {
        nodes: [{
          identifier: 'ENG-42',
          title: 'Fix auth bug',
          description: 'Users cannot log in.',
          state: { name: 'In Progress' },
          priority: 1,
          assignee: { name: 'Alice' },
          creator: { name: 'Bob' },
          project: { name: 'Q1 Security' },
          labels: { nodes: [{ name: 'bug' }, { name: 'security' }] },
          comments: { nodes: [
            { body: 'Investigating now', user: { name: 'Alice' }, createdAt: '2024-01-01T00:00:00Z' }
          ]},
          createdAt: '2023-12-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }]
      }
    });
    const result = await getIssue.execute({ identifier: 'ENG-42' }, ctx);
    assert.ok(result.includes('ENG-42'));
    assert.ok(result.includes('Fix auth bug'));
    assert.ok(result.includes('In Progress'));
    assert.ok(result.includes('Urgent'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('Bob'));
    assert.ok(result.includes('Q1 Security'));
    assert.ok(result.includes('bug'));
    assert.ok(result.includes('security'));
    assert.ok(result.includes('Users cannot log in.'));
    assert.ok(result.includes('Investigating now'));
  });

  it('returns "not found" message when issue missing', async () => {
    const { ctx } = makeCtx({ issues: { nodes: [] } });
    const result = await getIssue.execute({ identifier: 'ENG-999' }, ctx);
    assert.ok(result.includes('ENG-999'));
    assert.ok(result.includes('not found'));
  });

  it('handles issue with no optional fields', async () => {
    const { ctx } = makeCtx({
      issues: {
        nodes: [{
          identifier: 'ENG-1',
          title: 'Minimal',
          state: { name: 'Todo' },
          priority: 0,
          labels: { nodes: [] },
          comments: { nodes: [] }
        }]
      }
    });
    const result = await getIssue.execute({ identifier: 'ENG-1' }, ctx);
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Minimal'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 401 });
    await assert.rejects(() => getIssue.execute({ identifier: 'ENG-1' }, ctx), /401/);
  });
});

// ---------------------------------------------------------------------------
// Tool: create_issue
// ---------------------------------------------------------------------------

describe('create_issue', () => {
  it('happy path — creates issue with title and teamKey', async () => {
    const multiCtx = makeMultiCtx([
      { data: { teams: { nodes: [{ id: 'team-abc' }] } } },
      { data: { issueCreate: { issue: { identifier: 'ENG-100', title: 'New Bug', state: { name: 'Todo' } } } } }
    ]);
    const result = await createIssue.execute({ title: 'New Bug', teamKey: 'ENG' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-100'));
    assert.ok(result.includes('New Bug'));
    assert.ok(result.includes('Todo'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 2, 'should make 2 calls: team lookup + mutation');
    assert.ok(calls[0].body.query.includes('ENG'), `First call should look up team: ${calls[0].body.query}`);
  });

  it('returns "Team not found" message when team missing', async () => {
    const multiCtx = makeMultiCtx([
      { data: { teams: { nodes: [] } } }
    ]);
    const result = await createIssue.execute({ title: 'Bug', teamKey: 'NOPE' }, multiCtx.ctx);
    assert.ok(result.includes('NOPE'));
    assert.ok(result.includes('not found'));
  });

  it('looks up assignee when assigneeName provided', async () => {
    const multiCtx = makeMultiCtx([
      { data: { teams: { nodes: [{ id: 'team-abc' }] } } },
      { data: { users: { nodes: [{ id: 'user-xyz' }] } } },
      { data: { issueCreate: { issue: { identifier: 'ENG-101', title: 'Assigned Bug', state: { name: 'Todo' } } } } }
    ]);
    const result = await createIssue.execute({
      title: 'Assigned Bug', teamKey: 'ENG', assigneeName: 'Alice'
    }, multiCtx.ctx);
    assert.ok(result.includes('ENG-101'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 3, 'should make 3 calls: team + user + mutation');
  });

  it('includes priority in mutation vars when provided', async () => {
    const multiCtx = makeMultiCtx([
      { data: { teams: { nodes: [{ id: 'team-abc' }] } } },
      { data: { issueCreate: { issue: { identifier: 'ENG-102', title: 'Urgent', state: { name: 'Todo' } } } } }
    ]);
    await createIssue.execute({ title: 'Urgent', teamKey: 'ENG', priority: 1 }, multiCtx.ctx);
    const calls = multiCtx.getCalls();
    const mutationCall = calls[1];
    assert.equal(mutationCall.body.variables.priority, 1);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    await assert.rejects(() => createIssue.execute({ title: 'T', teamKey: 'ENG' }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: update_issue
// ---------------------------------------------------------------------------

describe('update_issue', () => {
  it('happy path — updates issue title', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-123' }] } } },
      { data: { issueUpdate: { issue: { identifier: 'ENG-42', title: 'Updated Title' } } } }
    ]);
    const result = await updateIssue.execute({ identifier: 'ENG-42', title: 'Updated Title' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-42'));
    assert.ok(result.includes('Updated Title'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.variables.id, 'issue-123');
    assert.equal(calls[1].body.variables.input.title, 'Updated Title');
  });

  it('returns "not found" message when issue missing', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [] } } }
    ]);
    const result = await updateIssue.execute({ identifier: 'ENG-999', title: 'T' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-999'));
    assert.ok(result.includes('not found'));
  });

  it('only sends provided update fields', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-abc' }] } } },
      { data: { issueUpdate: { issue: { identifier: 'ENG-10', title: 'Same title' } } } }
    ]);
    await updateIssue.execute({ identifier: 'ENG-10', priority: 2 }, multiCtx.ctx);
    const calls = multiCtx.getCalls();
    const input = calls[1].body.variables.input;
    assert.equal(input.priority, 2);
    assert.equal(input.title, undefined);
    assert.equal(input.description, undefined);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => updateIssue.execute({ identifier: 'ENG-1', title: 'T' }, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: change_status
// ---------------------------------------------------------------------------

describe('change_status', () => {
  it('happy path — changes issue status', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-abc', team: { id: 'team-xyz' } }] } } },
      { data: { workflowStates: { nodes: [{ id: 'state-done', name: 'Done' }] } } },
      { data: { issueUpdate: { issue: { identifier: 'ENG-5', title: 'T', state: { name: 'Done' } } } } }
    ]);
    const result = await changeStatus.execute({ identifier: 'ENG-5', status: 'Done' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-5'));
    assert.ok(result.includes('Done'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 3);
  });

  it('returns "Issue not found" message when issue missing', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [] } } }
    ]);
    const result = await changeStatus.execute({ identifier: 'ENG-999', status: 'Done' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-999'));
    assert.ok(result.includes('not found'));
  });

  it('returns "Status not found" when state missing for team', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-abc', team: { id: 'team-xyz' } }] } } },
      { data: { workflowStates: { nodes: [] } } }
    ]);
    const result = await changeStatus.execute({ identifier: 'ENG-5', status: 'Nonexistent' }, multiCtx.ctx);
    assert.ok(result.includes('Nonexistent'));
    assert.ok(result.includes('not found'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 401 });
    await assert.rejects(() => changeStatus.execute({ identifier: 'ENG-1', status: 'Done' }, ctx), /401/);
  });
});

// ---------------------------------------------------------------------------
// Tool: assign_issue
// ---------------------------------------------------------------------------

describe('assign_issue', () => {
  it('happy path — assigns issue to user', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-abc' }] } } },
      { data: { users: { nodes: [{ id: 'user-xyz', name: 'Alice Smith' }] } } },
      { data: { issueUpdate: { issue: { identifier: 'ENG-10' } } } }
    ]);
    const result = await assignIssue.execute({ identifier: 'ENG-10', assigneeName: 'Alice' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-10'));
    assert.ok(result.includes('Alice Smith'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 3);
    assert.equal(calls[2].body.variables.assigneeId, 'user-xyz');
  });

  it('returns "Issue not found" when issue missing', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [] } } }
    ]);
    const result = await assignIssue.execute({ identifier: 'ENG-999', assigneeName: 'Alice' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-999'));
    assert.ok(result.includes('not found'));
  });

  it('returns "User not found" when user missing', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-abc' }] } } },
      { data: { users: { nodes: [] } } }
    ]);
    const result = await assignIssue.execute({ identifier: 'ENG-5', assigneeName: 'Nobody' }, multiCtx.ctx);
    assert.ok(result.includes('Nobody'));
    assert.ok(result.includes('not found'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => assignIssue.execute({ identifier: 'ENG-1', assigneeName: 'Alice' }, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: add_comment
// ---------------------------------------------------------------------------

describe('add_comment', () => {
  it('happy path — adds comment and returns confirmation', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [{ id: 'issue-abc' }] } } },
      { data: { commentCreate: { comment: { id: 'comment-xyz' } } } }
    ]);
    const result = await addComment.execute({ identifier: 'ENG-5', body: 'This is my comment.' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-5'));
    assert.ok(result.includes('Comment added'));
    const calls = multiCtx.getCalls();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.variables.body, 'This is my comment.');
    assert.equal(calls[1].body.variables.issueId, 'issue-abc');
  });

  it('returns "Issue not found" when issue missing', async () => {
    const multiCtx = makeMultiCtx([
      { data: { issues: { nodes: [] } } }
    ]);
    const result = await addComment.execute({ identifier: 'ENG-999', body: 'comment' }, multiCtx.ctx);
    assert.ok(result.includes('ENG-999'));
    assert.ok(result.includes('not found'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    await assert.rejects(() => addComment.execute({ identifier: 'ENG-1', body: 'test' }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: list_projects
// ---------------------------------------------------------------------------

describe('list_projects', () => {
  it('happy path — returns formatted projects', async () => {
    const { ctx, getCaptured } = makeCtx({
      projects: {
        nodes: [
          { name: 'Q1 Initiative', state: 'started', progress: 0.5, lead: { name: 'Alice' } },
          { name: 'Platform Revamp', state: 'planned', progress: 0, lead: null }
        ]
      }
    });
    const result = await listProjects.execute({}, ctx);
    assert.ok(result.includes('Q1 Initiative'));
    assert.ok(result.includes('50%'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('Platform Revamp'));
    const { url } = getCaptured();
    assert.equal(url, LINEAR_GRAPHQL_URL);
  });

  it('returns "No projects found." for empty nodes', async () => {
    const { ctx } = makeCtx({ projects: { nodes: [] } });
    const result = await listProjects.execute({}, ctx);
    assert.equal(result, 'No projects found.');
  });

  it('respects limit param in query', async () => {
    const { ctx, getCaptured } = makeCtx({ projects: { nodes: [] } });
    await listProjects.execute({ limit: 5 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(body.query.includes('5'), `Query should include limit: ${body.query}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 401 });
    await assert.rejects(() => listProjects.execute({}, ctx), /401/);
  });
});

// ---------------------------------------------------------------------------
// Tool: get_project
// ---------------------------------------------------------------------------

describe('get_project', () => {
  it('happy path — returns project with issues', async () => {
    const { ctx } = makeCtx({
      projects: {
        nodes: [{
          name: 'Q1 Security',
          state: 'started',
          progress: 0.6,
          description: 'Securing the platform',
          lead: { name: 'Alice' },
          startDate: '2024-01-01',
          targetDate: '2024-03-31',
          issues: {
            nodes: [
              { identifier: 'ENG-1', title: 'Issue 1', state: { name: 'Done' }, priority: 0, assignee: null },
              { identifier: 'ENG-2', title: 'Issue 2', state: { name: 'Todo' }, priority: 3, assignee: { name: 'Bob' } }
            ]
          }
        }]
      }
    });
    const result = await getProject.execute({ name: 'Q1 Security' }, ctx);
    assert.ok(result.includes('Q1 Security'));
    assert.ok(result.includes('started'));
    assert.ok(result.includes('60%'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('2024-01-01'));
    assert.ok(result.includes('2024-03-31'));
    assert.ok(result.includes('Securing the platform'));
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('ENG-2'));
    assert.ok(result.includes('Issues (2)'));
  });

  it('returns "not found" when project missing', async () => {
    const { ctx } = makeCtx({ projects: { nodes: [] } });
    const result = await getProject.execute({ name: 'Ghost Project' }, ctx);
    assert.ok(result.includes('Ghost Project'));
    assert.ok(result.includes('not found'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => getProject.execute({ name: 'P' }, ctx), /500/);
  });
});

// ---------------------------------------------------------------------------
// Tool: current_cycle
// ---------------------------------------------------------------------------

describe('current_cycle', () => {
  it('happy path — returns active cycle with issues', async () => {
    const { ctx } = makeCtx({
      teams: {
        nodes: [{
          activeCycle: {
            number: 12,
            startsAt: '2024-01-01T00:00:00Z',
            endsAt: '2024-01-14T00:00:00Z',
            progress: 0.5,
            issues: {
              nodes: [
                { identifier: 'ENG-1', title: 'Task A', state: { name: 'In Progress' }, priority: 2, assignee: { name: 'Alice' } }
              ]
            }
          }
        }]
      }
    });
    const result = await currentCycle.execute({ teamKey: 'ENG' }, ctx);
    assert.ok(result.includes('Cycle 12'));
    assert.ok(result.includes('50%'));
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Task A'));
  });

  it('returns "No active cycle" when activeCycle is null', async () => {
    const { ctx } = makeCtx({ teams: { nodes: [{ activeCycle: null }] } });
    const result = await currentCycle.execute({ teamKey: 'ENG' }, ctx);
    assert.ok(result.includes('No active cycle'));
    assert.ok(result.includes('ENG'));
  });

  it('returns "No active cycle" when team not found', async () => {
    const { ctx } = makeCtx({ teams: { nodes: [] } });
    const result = await currentCycle.execute({ teamKey: 'NOPE' }, ctx);
    assert.ok(result.includes('No active cycle'));
  });

  it('handles cycle with no issues', async () => {
    const { ctx } = makeCtx({
      teams: {
        nodes: [{
          activeCycle: {
            number: 5,
            startsAt: '2024-01-01T00:00:00Z',
            endsAt: '2024-01-14T00:00:00Z',
            progress: 0,
            issues: { nodes: [] }
          }
        }]
      }
    });
    const result = await currentCycle.execute({ teamKey: 'ENG' }, ctx);
    assert.ok(result.includes('Cycle 5'));
    assert.ok(!result.includes('issues:'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 403 });
    await assert.rejects(() => currentCycle.execute({ teamKey: 'ENG' }, ctx), /403/);
  });
});

// ---------------------------------------------------------------------------
// Tool: search (full-text)
// ---------------------------------------------------------------------------

describe('search', () => {
  it('happy path — returns matching issues', async () => {
    const { ctx, getCaptured } = makeCtx({
      searchIssues: {
        nodes: [
          { identifier: 'ENG-5', title: 'Auth bug', state: { name: 'In Progress' }, priority: 1, assignee: { name: 'Alice' } }
        ]
      }
    });
    const result = await search.execute({ query: 'auth' }, ctx);
    assert.ok(result.includes('ENG-5'));
    assert.ok(result.includes('Auth bug'));
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(body.query.includes('auth'), `Query should contain search term: ${body.query}`);
  });

  it('returns "No results" message for empty', async () => {
    const { ctx } = makeCtx({ searchIssues: { nodes: [] } });
    const result = await search.execute({ query: 'zzznoresults' }, ctx);
    assert.ok(result.includes('No results'));
    assert.ok(result.includes('zzznoresults'));
  });

  it('respects limit in query', async () => {
    const { ctx, getCaptured } = makeCtx({ searchIssues: { nodes: [] } });
    await search.execute({ query: 'test', limit: 5 }, ctx);
    const { opts } = getCaptured();
    const body = JSON.parse(opts.body);
    assert.ok(body.query.includes('5'), `Query should include limit: ${body.query}`);
  });

  it('throws on API error', async () => {
    const { ctx } = makeCtx(null, { ok: false, status: 500 });
    await assert.rejects(() => search.execute({ query: 'test' }, ctx), /500/);
  });
});
