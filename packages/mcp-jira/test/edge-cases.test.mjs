import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'jira.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

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
  writeFileSync(CONFIG_PATH, JSON.stringify({
    domain: 'test-domain',
    email: 'test@example.com',
    token: 'test-fake-token',
  }));

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
// JQL query construction for search
// ---------------------------------------------------------------------------
describe('JQL query construction', () => {
  it('encodes special characters in JQL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'summary ~ "foo & bar"' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes(encodeURIComponent('summary ~ "foo & bar"')));
  });

  it('encodes JQL with equals and spaces', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'project = "MY PROJECT" AND status = Open' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes(encodeURIComponent('project = "MY PROJECT" AND status = Open')));
  });

  it('encodes JQL with ORDER BY clause', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'project = X ORDER BY created DESC' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes(encodeURIComponent('project = X ORDER BY created DESC')));
  });

  it('my_issues constructs proper currentUser JQL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_my_issues')({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    const decoded = decodeURIComponent(url);
    assert.ok(decoded.includes('assignee = currentUser()'));
    assert.ok(decoded.includes('resolution = Unresolved'));
    assert.ok(decoded.includes('ORDER BY priority DESC'));
  });
});

// ---------------------------------------------------------------------------
// Transition with empty transitions list
// ---------------------------------------------------------------------------
describe('transition edge cases', () => {
  it('reports empty available list when no transitions exist', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ transitions: [] }));
    const result = await handler('jira_transition_issue')({ issueKey: 'X-1', transitionName: 'Done' });
    assert.ok(result.includes('not found'));
    assert.ok(result.includes('Available:'));
  });

  it('handles transition names with special characters', async () => {
    mock.method(globalThis, 'fetch', async (url, opts) => {
      if (opts.method === 'GET') {
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ transitions: [{ id: '50', name: "Won't Fix" }] }),
          json: async () => ({ transitions: [{ id: '50', name: "Won't Fix" }] }),
        };
      }
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    const result = await handler('jira_transition_issue')({ issueKey: 'BUG-1', transitionName: "won't fix" });
    assert.ok(result.includes("Won't Fix"));
  });
});

// ---------------------------------------------------------------------------
// Create/update with all optional fields
// ---------------------------------------------------------------------------
describe('create issue with all optional fields', () => {
  it('includes description as ADF with correct structure', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ key: 'PROJ-1' }),
        json: async () => ({ key: 'PROJ-1' }),
      };
    });
    await handler('jira_create_issue')({
      projectKey: 'PROJ',
      summary: 'Full issue',
      description: 'Line one\nLine two',
      issueType: 'Bug',
      priority: 'Critical',
      assigneeId: 'acc-123',
    });
    const desc = capturedBody.fields.description;
    assert.equal(desc.type, 'doc');
    assert.equal(desc.version, 1);
    assert.ok(Array.isArray(desc.content));
    assert.equal(desc.content[0].type, 'paragraph');
    assert.equal(desc.content[0].content[0].type, 'text');
    assert.equal(desc.content[0].content[0].text, 'Line one\nLine two');
  });

  it('creates issue with custom issueType', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 201,
        text: async () => JSON.stringify({ key: 'PROJ-2' }),
        json: async () => ({ key: 'PROJ-2' }),
      };
    });
    await handler('jira_create_issue')({ projectKey: 'PROJ', summary: 'Epic thing', issueType: 'Epic' });
    assert.equal(capturedBody.fields.issuetype.name, 'Epic');
  });
});

describe('update issue with partial fields', () => {
  it('only includes provided fields in request body', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    await handler('jira_update_issue')({ issueKey: 'PROJ-1', priority: 'High' });
    assert.equal(capturedBody.fields.priority.name, 'High');
    assert.equal(capturedBody.fields.summary, undefined);
    assert.equal(capturedBody.fields.description, undefined);
    assert.equal(capturedBody.fields.assignee, undefined);
  });

  it('sends empty fields object when only issueKey provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
    });
    await handler('jira_update_issue')({ issueKey: 'PROJ-1' });
    assert.deepEqual(capturedBody.fields, {});
  });
});

// ---------------------------------------------------------------------------
// Pagination (startAt, maxResults)
// ---------------------------------------------------------------------------
describe('pagination', () => {
  it('search passes maxResults from limit parameter', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'x', limit: 50 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('maxResults=50'));
  });

  it('my_issues passes maxResults from limit parameter', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_my_issues')({ limit: 3 });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('maxResults=3'));
  });

  it('search includes fields parameter', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    await handler('jira_search_issues')({ jql: 'x' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('fields='));
  });
});

// ---------------------------------------------------------------------------
// Special characters in issue keys and project keys
// ---------------------------------------------------------------------------
describe('special characters in keys', () => {
  it('handles issue key with numbers', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'ABC123-456',
      fields: { summary: 's', status: {}, priority: {}, issuetype: {}, created: '', updated: '', description: null, comment: { comments: [] } },
    }));
    const result = await handler('jira_get_issue')({ issueKey: 'ABC123-456' });
    assert.ok(result.includes('ABC123-456'));
  });

  it('passes issue key directly in URL path', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'X-1',
      fields: { summary: 's', status: {}, priority: {}, issuetype: {}, created: '', updated: '', description: null, comment: { comments: [] } },
    }));
    await handler('jira_get_issue')({ issueKey: 'X-1' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.endsWith('/rest/api/3/issue/X-1?fields=summary,description,status,assignee,reporter,priority,issuetype,created,updated,comment') || url.includes('/issue/X-1'));
  });

  it('handles project key in get_project URL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ key: 'MY_PROJ', name: 'Test', id: '1' }));
    await handler('jira_get_project')({ projectKey: 'MY_PROJ' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/project/MY_PROJ'));
  });

  it('handles project key in list_statuses URL', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_statuses')({ projectKey: 'A2B' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('/project/A2B/statuses'));
  });

  it('handles project key in list_users query param', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_users')({ projectKey: 'X_Y' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('project=X_Y'));
  });
});

// ---------------------------------------------------------------------------
// Agile vs REST API routing
// ---------------------------------------------------------------------------
describe('agile vs REST API routing', () => {
  it('list_sprints uses agile base URL directly (not /rest/api/3 prefix)', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    await handler('jira_list_sprints')({ boardId: '10' });
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('.atlassian.net/rest/agile/1.0/board/10/sprint'));
  });

  it('list_boards uses agile base URL directly', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    await handler('jira_list_boards')();
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('.atlassian.net/rest/agile/1.0/board'));
  });

  it('list_projects uses REST API v3', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    await handler('jira_list_projects')({});
    const [url] = globalThis.fetch.mock.calls[0].arguments;
    assert.ok(url.includes('.atlassian.net/rest/api/3/'));
  });
});

// ---------------------------------------------------------------------------
// 204 No Content handling
// ---------------------------------------------------------------------------
describe('204 No Content handling', () => {
  it('update_issue handles 204 response without parsing JSON body', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 204,
      text: async () => '',
      json: async () => { throw new Error('No body'); },
    }));
    const result = await handler('jira_update_issue')({ issueKey: 'X-1', summary: 'Y' });
    assert.ok(result.includes('updated'));
  });

  it('assign_issue handles 204 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 204,
      text: async () => '',
      json: async () => { throw new Error('No body'); },
    }));
    const result = await handler('jira_assign_issue')({ issueKey: 'X-1', assigneeId: 'a' });
    assert.ok(result.includes('assigned'));
  });
});

// ---------------------------------------------------------------------------
// Empty / null data in responses
// ---------------------------------------------------------------------------
describe('null and missing fields in responses', () => {
  it('search_issues handles issue with all null optional fields', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      issues: [{
        key: 'X-1',
        fields: {
          summary: 'Bare',
          status: null,
          assignee: null,
          priority: null,
          issuetype: null,
        },
      }],
    }));
    const result = await handler('jira_search_issues')({ jql: 'x' });
    assert.ok(result.includes('X-1'));
    assert.ok(result.includes('Bare'));
    assert.ok(result.includes('Unassigned'));
  });

  it('get_issue handles null assignee, reporter, and empty comment body', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'X-1',
      fields: {
        summary: 'Test',
        status: { name: 'Open' },
        priority: { name: 'Medium' },
        assignee: null,
        reporter: null,
        issuetype: { name: 'Task' },
        created: '2026-01-01',
        updated: '2026-01-01',
        description: null,
        comment: {
          comments: [{
            author: null,
            created: '2026-01-02',
            body: null,
          }],
        },
      },
    }));
    const result = await handler('jira_get_issue')({ issueKey: 'X-1' });
    assert.ok(result.includes('X-1'));
    assert.ok(!result.includes('Assignee:'));
    assert.ok(!result.includes('Reporter:'));
  });

  it('list_sprints handles sprint with no start/end dates', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      values: [{ name: 'Future Sprint', state: 'future', startDate: null, endDate: null }],
    }));
    const result = await handler('jira_list_sprints')({ boardId: '1' });
    assert.ok(result.includes('Future Sprint'));
    assert.ok(result.includes('?'));
  });

  it('list_issue_types handles no issueTypes in project response', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ key: 'X', name: 'X' }));
    const result = await handler('jira_list_issue_types')({ projectKey: 'X' });
    assert.equal(result, 'No issue types found.');
  });
});

// ---------------------------------------------------------------------------
// ADF extraction edge cases
// ---------------------------------------------------------------------------
describe('ADF text extraction edge cases', () => {
  it('extracts nested ADF text from description', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      key: 'X-1',
      fields: {
        summary: 'Test',
        status: { name: 'Open' },
        priority: { name: 'Low' },
        issuetype: { name: 'Task' },
        created: '2026-01-01',
        updated: '2026-01-01',
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Hello ' },
                { type: 'text', text: 'World' },
              ],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Second paragraph' },
              ],
            },
          ],
        },
        comment: { comments: [] },
      },
    }));
    const result = await handler('jira_get_issue')({ issueKey: 'X-1' });
    assert.ok(result.includes('Hello World'));
    assert.ok(result.includes('Second paragraph'));
  });
});

// ---------------------------------------------------------------------------
// Handler called with no arguments (for optional-only tools)
// ---------------------------------------------------------------------------
describe('handlers with no arguments', () => {
  it('jira_list_boards works when called with no args', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ values: [] }));
    const result = await handler('jira_list_boards')();
    assert.equal(result, 'No boards found.');
  });

  it('jira_my_issues works when called with no args', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ issues: [] }));
    const result = await handler('jira_my_issues')();
    assert.equal(result, 'No issues assigned to you.');
  });

  it('jira_list_projects works when called with no args', async () => {
    mock.method(globalThis, 'fetch', fakeFetch([]));
    const result = await handler('jira_list_projects')();
    assert.equal(result, 'No projects found.');
  });
});
