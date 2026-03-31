import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'jira.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

const TEST_CONFIG = {
  domain: 'test-domain',
  email: 'test@example.com',
  token: 'test-fake-token',
};
const EXPECTED_AUTH = Buffer.from(`${TEST_CONFIG.email}:${TEST_CONFIG.token}`).toString('base64');

let tools;
let toolMap;

function handler(name) {
  return toolMap[name].handler;
}

function fakeFetch(data, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  });
}

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(TEST_CONFIG));

  const mod = await import('../connectors/jira.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));

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

// ---------------------------------------------------------------------------
// Auth header verification
// ---------------------------------------------------------------------------
describe('jira auth headers', () => {
  it('sends Basic auth header with base64-encoded credentials', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_projects')({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(opts.headers['Authorization'].startsWith('Basic '), 'Auth header should use Basic scheme');
    // Verify the base64 value decodes to email:token format
    const b64 = opts.headers['Authorization'].replace('Basic ', '');
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    assert.ok(decoded.includes(':'), 'Basic auth should be email:token format');
  });

  it('sends Content-Type and Accept as application/json', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_projects')({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.headers['Content-Type'], 'application/json');
    assert.equal(opts.headers['Accept'], 'application/json');
  });
});

// ---------------------------------------------------------------------------
// jira_list_projects
// ---------------------------------------------------------------------------
describe('jira_list_projects handler', () => {
  it('returns formatted project list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { key: 'PROJ', name: 'Project One', id: '10001' },
      { key: 'DEV', name: 'Development', id: '10002' },
    ]));
    const result = await handler('jira_list_projects')({});
    assert.ok(result.includes('PROJ'));
    assert.ok(result.includes('Project One'));
    assert.ok(result.includes('10001'));
    assert.ok(result.includes('DEV'));
    assert.ok(result.includes('Development'));
  });

  it('returns message when no projects found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('jira_list_projects')({});
    assert.equal(result, 'No projects found.');
  });

  it('calls correct URL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_projects')({});
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('.atlassian.net/rest/api/3/project'), `URL should include atlassian.net/rest/api/3/project, got: ${url}`);
    assert.equal(opts.method, 'GET');
  });
});

// ---------------------------------------------------------------------------
// jira_get_project
// ---------------------------------------------------------------------------
describe('jira_get_project handler', () => {
  it('returns formatted project details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'PROJ', name: 'Project One', id: '10001',
      description: 'A great project',
      projectTypeKey: 'software',
      lead: { displayName: 'Jane Doe' },
      url: 'https://example.com',
    }));
    const result = await handler('jira_get_project')({ projectKey: 'PROJ' });
    assert.ok(result.includes('PROJ'));
    assert.ok(result.includes('Project One'));
    assert.ok(result.includes('10001'));
    assert.ok(result.includes('A great project'));
    assert.ok(result.includes('software'));
    assert.ok(result.includes('Jane Doe'));
    assert.ok(result.includes('https://example.com'));
  });

  it('calls correct URL with project key', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ key: 'TEST', name: 'Test', id: '1' }));
    await handler('jira_get_project')({ projectKey: 'TEST' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/project/TEST'));
  });

  it('handles project with no optional fields', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'MIN', name: 'Minimal', id: '999',
    }));
    const result = await handler('jira_get_project')({ projectKey: 'MIN' });
    assert.ok(result.includes('MIN'));
    assert.ok(result.includes('Minimal'));
    assert.ok(!result.includes('Description:'));
    assert.ok(!result.includes('Lead:'));
    assert.ok(!result.includes('URL:'));
  });
});

// ---------------------------------------------------------------------------
// jira_search_issues
// ---------------------------------------------------------------------------
describe('jira_search_issues handler', () => {
  it('returns formatted issue list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      issues: [
        {
          key: 'PROJ-1',
          fields: {
            summary: 'Fix the bug',
            status: { name: 'Open' },
            assignee: { displayName: 'Alice' },
            priority: { name: 'High' },
            issuetype: { name: 'Bug' },
          },
        },
        {
          key: 'PROJ-2',
          fields: {
            summary: 'Add feature',
            status: { name: 'In Progress' },
            assignee: null,
            priority: { name: 'Medium' },
            issuetype: { name: 'Story' },
          },
        },
      ],
    }));
    const result = await handler('jira_search_issues')({ jql: 'project = PROJ' });
    assert.ok(result.includes('PROJ-1'));
    assert.ok(result.includes('Fix the bug'));
    assert.ok(result.includes('Open'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('High'));
    assert.ok(result.includes('Bug'));
    assert.ok(result.includes('PROJ-2'));
    assert.ok(result.includes('Unassigned'));
  });

  it('returns message when no issues found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    const result = await handler('jira_search_issues')({ jql: 'project = EMPTY' });
    assert.equal(result, 'No issues found.');
  });

  it('constructs correct URL with encoded JQL and limit', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'status = "In Progress"', limit: 10 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/search'));
    assert.ok(url.includes(encodeURIComponent('status = "In Progress"')));
    assert.ok(url.includes('maxResults=10'));
  });

  it('uses default limit of 20', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'project = X' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('maxResults=20'));
  });
});

// ---------------------------------------------------------------------------
// jira_get_issue
// ---------------------------------------------------------------------------
describe('jira_get_issue handler', () => {
  it('returns full issue details with description and comments', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'PROJ-42',
      fields: {
        summary: 'Something is broken',
        status: { name: 'Open' },
        priority: { name: 'Critical' },
        assignee: { displayName: 'Bob' },
        reporter: { displayName: 'Carol' },
        issuetype: { name: 'Bug' },
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
        description: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Detailed description here' }] }],
        },
        comment: {
          comments: [
            {
              author: { displayName: 'Dave' },
              created: '2026-01-03T00:00:00Z',
              body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Working on it' }] }] },
            },
          ],
        },
      },
    }));
    const result = await handler('jira_get_issue')({ issueKey: 'PROJ-42' });
    assert.ok(result.includes('PROJ-42'));
    assert.ok(result.includes('Something is broken'));
    assert.ok(result.includes('Open'));
    assert.ok(result.includes('Critical'));
    assert.ok(result.includes('Bob'));
    assert.ok(result.includes('Carol'));
    assert.ok(result.includes('Bug'));
    assert.ok(result.includes('2026-01-01'));
    assert.ok(result.includes('2026-01-02'));
    assert.ok(result.includes('Detailed description here'));
    assert.ok(result.includes('Dave'));
    assert.ok(result.includes('Working on it'));
  });

  it('handles issue with no description or comments', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'PROJ-1',
      fields: {
        summary: 'Bare issue',
        status: { name: 'Done' },
        priority: { name: 'Low' },
        issuetype: { name: 'Task' },
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        description: null,
        comment: { comments: [] },
      },
    }));
    const result = await handler('jira_get_issue')({ issueKey: 'PROJ-1' });
    assert.ok(result.includes('PROJ-1'));
    assert.ok(result.includes('Bare issue'));
    assert.ok(!result.includes('Description:'));
    assert.ok(!result.includes('Comments:'));
  });

  it('calls correct URL with issueKey', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'ABC-99',
      fields: { summary: 'x', status: {}, priority: {}, issuetype: {}, created: '', updated: '', description: null, comment: { comments: [] } },
    }));
    await handler('jira_get_issue')({ issueKey: 'ABC-99' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/issue/ABC-99'));
  });
});

// ---------------------------------------------------------------------------
// jira_create_issue
// ---------------------------------------------------------------------------
describe('jira_create_issue handler', () => {
  it('creates issue and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ key: 'PROJ-100' }),
        json: async () => ({ key: 'PROJ-100' }),
      };
    });
    const result = await handler('jira_create_issue')({ projectKey: 'PROJ', summary: 'New task' });
    assert.ok(result.includes('PROJ-100'));
    assert.ok(result.includes('New task'));
    assert.equal(capturedBody.fields.project.key, 'PROJ');
    assert.equal(capturedBody.fields.summary, 'New task');
    assert.equal(capturedBody.fields.issuetype.name, 'Task');
  });

  it('sends POST method', async () => {
    mock.method(globalThis, 'fetch', async (url, opts) => ({
      ok: true, status: 201,
      text: async () => JSON.stringify({ key: 'X-1' }),
      json: async () => ({ key: 'X-1' }),
    }));
    await handler('jira_create_issue')({ projectKey: 'X', summary: 'Test' });
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.method, 'POST');
  });

  it('includes optional fields when provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ key: 'PROJ-200' }),
        json: async () => ({ key: 'PROJ-200' }),
      };
    });
    await handler('jira_create_issue')({
      projectKey: 'PROJ',
      summary: 'Full issue',
      description: 'A detailed description',
      issueType: 'Bug',
      priority: 'High',
      assigneeId: 'abc123',
    });
    assert.equal(capturedBody.fields.issuetype.name, 'Bug');
    assert.equal(capturedBody.fields.priority.name, 'High');
    assert.equal(capturedBody.fields.assignee.accountId, 'abc123');
    // description should be ADF
    assert.equal(capturedBody.fields.description.type, 'doc');
    assert.equal(capturedBody.fields.description.version, 1);
  });

  it('omits optional fields when not provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ key: 'PROJ-300' }),
        json: async () => ({ key: 'PROJ-300' }),
      };
    });
    await handler('jira_create_issue')({ projectKey: 'PROJ', summary: 'Minimal' });
    assert.equal(capturedBody.fields.description, undefined);
    assert.equal(capturedBody.fields.priority, undefined);
    assert.equal(capturedBody.fields.assignee, undefined);
  });

  it('calls correct URL', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 201,
      text: async () => JSON.stringify({ key: 'X-1' }),
      json: async () => ({ key: 'X-1' }),
    }));
    await handler('jira_create_issue')({ projectKey: 'X', summary: 'T' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/issue'));
  });
});

// ---------------------------------------------------------------------------
// jira_update_issue
// ---------------------------------------------------------------------------
describe('jira_update_issue handler', () => {
  it('updates issue and returns confirmation', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 204,
      text: async () => '',
      json: async () => ({}),
    }));
    const result = await handler('jira_update_issue')({ issueKey: 'PROJ-1', summary: 'Updated title' });
    assert.ok(result.includes('PROJ-1'));
    assert.ok(result.includes('updated'));
  });

  it('sends PUT method', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 204,
      text: async () => '',
      json: async () => ({}),
    }));
    await handler('jira_update_issue')({ issueKey: 'PROJ-1', summary: 'X' });
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.method, 'PUT');
  });

  it('constructs correct request body with all fields', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    await handler('jira_update_issue')({
      issueKey: 'PROJ-1',
      summary: 'New title',
      description: 'New desc',
      priority: 'Low',
      assigneeId: 'user123',
    });
    assert.equal(capturedBody.fields.summary, 'New title');
    assert.equal(capturedBody.fields.description.type, 'doc');
    assert.equal(capturedBody.fields.priority.name, 'Low');
    assert.equal(capturedBody.fields.assignee.accountId, 'user123');
  });

  it('calls correct URL with issue key', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 204, text: async () => '', json: async () => ({}),
    }));
    await handler('jira_update_issue')({ issueKey: 'DEV-55' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/issue/DEV-55'));
  });
});

// ---------------------------------------------------------------------------
// jira_transition_issue
// ---------------------------------------------------------------------------
describe('jira_transition_issue handler', () => {
  it('transitions issue to matching status', async () => {
    let callCount = 0;
    let transitionBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      if (opts.method === 'GET') {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ transitions: [{ id: '31', name: 'Done' }, { id: '21', name: 'In Progress' }] }),
          json: async () => ({ transitions: [{ id: '31', name: 'Done' }, { id: '21', name: 'In Progress' }] }),
        };
      }
      transitionBody = JSON.parse(opts.body);
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    const result = await handler('jira_transition_issue')({ issueKey: 'PROJ-1', transitionName: 'Done' });
    assert.ok(result.includes('PROJ-1'));
    assert.ok(result.includes('Done'));
    assert.equal(transitionBody.transition.id, '31');
    assert.equal(callCount, 2);
  });

  it('returns error message when transition not found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      transitions: [{ id: '31', name: 'Done' }, { id: '21', name: 'In Progress' }],
    }));
    const result = await handler('jira_transition_issue')({ issueKey: 'PROJ-1', transitionName: 'Nonexistent' });
    assert.ok(result.includes('not found'));
    assert.ok(result.includes('Done'));
    assert.ok(result.includes('In Progress'));
  });

  it('matches transition name case-insensitively', async () => {
    let transitionBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      if (opts.method === 'GET') {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ transitions: [{ id: '31', name: 'Done' }] }),
          json: async () => ({ transitions: [{ id: '31', name: 'Done' }] }),
        };
      }
      transitionBody = JSON.parse(opts.body);
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    const result = await handler('jira_transition_issue')({ issueKey: 'PROJ-1', transitionName: 'done' });
    assert.ok(result.includes('Done'));
    assert.equal(transitionBody.transition.id, '31');
  });

  it('first calls GET transitions, then POST', async () => {
    const methods = [];
    mock.method(globalThis, 'fetch', async (url, opts) => {
      methods.push(opts.method);
      if (opts.method === 'GET') {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ transitions: [{ id: '1', name: 'Go' }] }),
          json: async () => ({ transitions: [{ id: '1', name: 'Go' }] }),
        };
      }
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    await handler('jira_transition_issue')({ issueKey: 'X-1', transitionName: 'Go' });
    assert.deepEqual(methods, ['GET', 'POST']);
  });
});

// ---------------------------------------------------------------------------
// jira_add_comment
// ---------------------------------------------------------------------------
describe('jira_add_comment handler', () => {
  it('adds comment and returns confirmation', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 201,
      text: async () => '{}',
      json: async () => ({}),
    }));
    const result = await handler('jira_add_comment')({ issueKey: 'PROJ-5', body: 'Looks good!' });
    assert.ok(result.includes('PROJ-5'));
    assert.ok(result.includes('Comment added'));
  });

  it('sends ADF body format', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => '{}', json: async () => ({}) };
    });
    await handler('jira_add_comment')({ issueKey: 'PROJ-5', body: 'Test comment' });
    assert.equal(capturedBody.body.type, 'doc');
    assert.equal(capturedBody.body.version, 1);
    assert.equal(capturedBody.body.content[0].content[0].text, 'Test comment');
  });

  it('calls correct URL and method', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 201, text: async () => '{}', json: async () => ({}),
    }));
    await handler('jira_add_comment')({ issueKey: 'DEV-10', body: 'hi' });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/issue/DEV-10/comment'));
    assert.equal(opts.method, 'POST');
  });
});

// ---------------------------------------------------------------------------
// jira_assign_issue
// ---------------------------------------------------------------------------
describe('jira_assign_issue handler', () => {
  it('assigns issue and returns confirmation', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 204, text: async () => '', json: async () => ({}),
    }));
    const result = await handler('jira_assign_issue')({ issueKey: 'PROJ-7', assigneeId: 'user456' });
    assert.ok(result.includes('PROJ-7'));
    assert.ok(result.includes('assigned'));
  });

  it('sends correct request body', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    await handler('jira_assign_issue')({ issueKey: 'X-1', assigneeId: 'acc789' });
    assert.equal(capturedBody.accountId, 'acc789');
  });

  it('calls correct URL and method', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 204, text: async () => '', json: async () => ({}),
    }));
    await handler('jira_assign_issue')({ issueKey: 'PROJ-3', assigneeId: 'x' });
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/issue/PROJ-3/assignee'));
    assert.equal(opts.method, 'PUT');
  });
});

// ---------------------------------------------------------------------------
// jira_list_statuses
// ---------------------------------------------------------------------------
describe('jira_list_statuses handler', () => {
  it('returns formatted status list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      {
        name: 'Task',
        statuses: [
          { name: 'To Do', id: '1' },
          { name: 'Done', id: '2' },
        ],
      },
      {
        name: 'Bug',
        statuses: [
          { name: 'Open', id: '3' },
        ],
      },
    ]));
    const result = await handler('jira_list_statuses')({ projectKey: 'PROJ' });
    assert.ok(result.includes('Task'));
    assert.ok(result.includes('To Do'));
    assert.ok(result.includes('id: 1'));
    assert.ok(result.includes('Done'));
    assert.ok(result.includes('Bug'));
    assert.ok(result.includes('Open'));
  });

  it('returns message when no statuses', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('jira_list_statuses')({ projectKey: 'EMPTY' });
    assert.equal(result, 'No statuses found.');
  });

  it('calls correct URL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_statuses')({ projectKey: 'TEST' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/project/TEST/statuses'));
  });
});

// ---------------------------------------------------------------------------
// jira_list_users
// ---------------------------------------------------------------------------
describe('jira_list_users handler', () => {
  it('returns formatted user list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([
      { displayName: 'Alice Smith', emailAddress: 'alice@example.com', accountId: 'a1' },
      { displayName: 'Bob Jones', emailAddress: null, accountId: 'b2' },
    ]));
    const result = await handler('jira_list_users')({ projectKey: 'PROJ' });
    assert.ok(result.includes('Alice Smith'));
    assert.ok(result.includes('alice@example.com'));
    assert.ok(result.includes('id: a1'));
    assert.ok(result.includes('Bob Jones'));
    assert.ok(result.includes('no email'));
  });

  it('returns message when no users', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('jira_list_users')({ projectKey: 'EMPTY' });
    assert.equal(result, 'No assignable users found.');
  });

  it('calls correct URL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_users')({ projectKey: 'PROJ' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/user/assignable/search?project=PROJ'));
  });
});

// ---------------------------------------------------------------------------
// jira_list_sprints
// ---------------------------------------------------------------------------
describe('jira_list_sprints handler', () => {
  it('returns formatted sprint list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      values: [
        { name: 'Sprint 1', state: 'active', startDate: '2026-01-01', endDate: '2026-01-14' },
        { name: 'Sprint 2', state: 'future', startDate: null, endDate: null },
      ],
    }));
    const result = await handler('jira_list_sprints')({ boardId: '42' });
    assert.ok(result.includes('Sprint 1'));
    assert.ok(result.includes('active'));
    assert.ok(result.includes('2026-01-01'));
    assert.ok(result.includes('2026-01-14'));
    assert.ok(result.includes('Sprint 2'));
    assert.ok(result.includes('future'));
  });

  it('returns message when no sprints', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    const result = await handler('jira_list_sprints')({ boardId: '99' });
    assert.equal(result, 'No sprints found.');
  });

  it('uses agile API path', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    await handler('jira_list_sprints')({ boardId: '42' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/agile/1.0/board/42/sprint'));
    // Should NOT be prefixed with /rest/api/3
    assert.ok(!url.includes('/rest/api/3/rest/agile'));
  });
});

// ---------------------------------------------------------------------------
// jira_list_boards
// ---------------------------------------------------------------------------
describe('jira_list_boards handler', () => {
  it('returns formatted board list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      values: [
        { name: 'Dev Board', type: 'scrum', id: 1 },
        { name: 'Kanban Board', type: 'kanban', id: 2 },
      ],
    }));
    const result = await handler('jira_list_boards')({});
    assert.ok(result.includes('Dev Board'));
    assert.ok(result.includes('scrum'));
    assert.ok(result.includes('id: 1'));
    assert.ok(result.includes('Kanban Board'));
    assert.ok(result.includes('kanban'));
  });

  it('returns message when no boards', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    const result = await handler('jira_list_boards')({});
    assert.equal(result, 'No boards found.');
  });

  it('uses agile API path', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    await handler('jira_list_boards')({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/agile/1.0/board'));
  });

  it('adds project filter when projectKey provided', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    await handler('jira_list_boards')({ projectKey: 'DEV' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('projectKeyOrId=DEV'));
  });

  it('does not add query param when no projectKey', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    await handler('jira_list_boards')({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(!url.includes('projectKeyOrId'));
  });
});

// ---------------------------------------------------------------------------
// jira_list_issue_types
// ---------------------------------------------------------------------------
describe('jira_list_issue_types handler', () => {
  it('returns formatted issue type list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      issueTypes: [
        { name: 'Task', subtask: false, description: 'A task', id: '10001' },
        { name: 'Sub-task', subtask: true, description: 'A subtask', id: '10002' },
      ],
    }));
    const result = await handler('jira_list_issue_types')({ projectKey: 'PROJ' });
    assert.ok(result.includes('Task'));
    assert.ok(result.includes('A task'));
    assert.ok(result.includes('Sub-task'));
    assert.ok(result.includes('(subtask)'));
    assert.ok(result.includes('id: 10002'));
  });

  it('returns message when no issue types', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issueTypes: [] }));
    const result = await handler('jira_list_issue_types')({ projectKey: 'EMPTY' });
    assert.equal(result, 'No issue types found.');
  });

  it('calls correct URL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issueTypes: [] }));
    await handler('jira_list_issue_types')({ projectKey: 'TEST' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/rest/api/3/project/TEST'));
  });
});

// ---------------------------------------------------------------------------
// jira_my_issues
// ---------------------------------------------------------------------------
describe('jira_my_issues handler', () => {
  it('returns formatted assigned issues', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      issues: [
        {
          key: 'PROJ-10',
          fields: {
            summary: 'My task',
            status: { name: 'In Progress' },
            priority: { name: 'High' },
            issuetype: { name: 'Task' },
          },
        },
      ],
    }));
    const result = await handler('jira_my_issues')({});
    assert.ok(result.includes('PROJ-10'));
    assert.ok(result.includes('My task'));
    assert.ok(result.includes('In Progress'));
    assert.ok(result.includes('High'));
  });

  it('returns message when no assigned issues', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    const result = await handler('jira_my_issues')({});
    assert.equal(result, 'No issues assigned to you.');
  });

  it('uses currentUser JQL and default limit', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_my_issues')({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes(encodeURIComponent('assignee = currentUser()')));
    assert.ok(url.includes('maxResults=20'));
  });

  it('uses custom limit when provided', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_my_issues')({ limit: 5 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('maxResults=5'));
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('jira error handling', () => {
  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
    }));
    await assert.rejects(
      () => handler('jira_list_projects')({}),
      (err) => {
        assert.ok(err.message.includes('Jira API 401'));
        return true;
      }
    );
  });

  it('throws on 404 not found', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
    }));
    await assert.rejects(
      () => handler('jira_get_issue')({ issueKey: 'GONE-999' }),
      (err) => {
        assert.ok(err.message.includes('Jira API 404'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
    }));
    await assert.rejects(
      () => handler('jira_search_issues')({ jql: 'x' }),
      (err) => {
        assert.ok(err.message.includes('Jira API 500'));
        return true;
      }
    );
  });

  it('error includes response body text', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 400,
      text: async () => '{"errorMessages":["Field required"]}',
    }));
    await assert.rejects(
      () => handler('jira_create_issue')({ projectKey: 'X', summary: 'Y' }),
      (err) => {
        assert.ok(err.message.includes('Field required'));
        return true;
      }
    );
  });

  it('error on assign includes status code', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 403,
      text: async () => 'Forbidden',
    }));
    await assert.rejects(
      () => handler('jira_assign_issue')({ issueKey: 'X-1', assigneeId: 'y' }),
      (err) => {
        assert.ok(err.message.includes('Jira API 403'));
        return true;
      }
    );
  });

  it('error on transition GET throws', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Issue not found',
    }));
    await assert.rejects(
      () => handler('jira_transition_issue')({ issueKey: 'GONE-1', transitionName: 'Done' }),
      (err) => {
        assert.ok(err.message.includes('Jira API 404'));
        return true;
      }
    );
  });
});
