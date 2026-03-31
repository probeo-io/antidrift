import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'linear.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

let tools;
let toolMap;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey: 'lin_test_fake_key' }));

  const mod = await import('../connectors/linear.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
});

after(() => {
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

function getTool(name) {
  return toolMap[name];
}

function mockGraphQL(status, data) {
  mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
    text: async () => (typeof data === 'string' ? data : JSON.stringify({ data })),
  }));
}

// ---------------------------------------------------------------------------
// Pagination — limit / first param
// ---------------------------------------------------------------------------
describe('linear pagination defaults', () => {
  it('linear_search_issues uses default limit of 20', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search_issues').handler({});
    assert.ok(capturedBody.query.includes('first: 20'));
  });

  it('linear_search_issues respects custom limit', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search_issues').handler({ limit: 5 });
    assert.ok(capturedBody.query.includes('first: 5'));
  });

  it('linear_list_projects uses default limit of 20', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { projects: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_list_projects').handler({});
    assert.ok(capturedBody.query.includes('first: 20'));
  });

  it('linear_search uses default limit of 20', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { searchIssues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search').handler({ query: 'test' });
    assert.ok(capturedBody.query.includes('first: 20'));
  });

  it('linear_search respects custom limit', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { searchIssues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search').handler({ query: 'test', limit: 3 });
    assert.ok(capturedBody.query.includes('first: 3'));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted from request
// ---------------------------------------------------------------------------
describe('linear optional params omitted', () => {
  it('linear_search_issues sends no filter when no params given', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search_issues').handler({});
    assert.ok(!capturedBody.query.includes('filter:'));
  });

  it('linear_search_issues includes teamKey filter when provided', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search_issues').handler({ teamKey: 'ENG' });
    assert.ok(capturedBody.query.includes('team: { key: { eq: "ENG" } }'));
  });

  it('linear_update_issue sends empty input when only identifier given', async () => {
    let callCount = 0;
    let capturedVars;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { issues: { nodes: [{ id: 'issue-1' }] } } }),
          text: async () => '{}',
        };
      }
      capturedVars = body.variables;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueUpdate: { issue: { identifier: 'ENG-1', title: 'Test', state: { name: 'Todo' } } } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_update_issue').handler({ identifier: 'ENG-1' });
    assert.deepEqual(capturedVars.input, {});
  });

  it('linear_create_issue does not pass priority when not provided', async () => {
    let callCount = 0;
    let capturedVars;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { teams: { nodes: [{ id: 'team-1' }] } } }),
          text: async () => '{}',
        };
      }
      capturedVars = body.variables;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueCreate: { issue: { identifier: 'ENG-50', title: 'Test', state: { name: 'Todo' } } } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_create_issue').handler({ title: 'Test', teamKey: 'ENG' });
    assert.equal(capturedVars.priority, undefined);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('linear error responses', () => {
  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({ message: 'Unauthorized' }),
    }));
    await assert.rejects(
      () => getTool('linear_search_issues').handler({}),
      (err) => {
        assert.ok(err.message.includes('Linear API 401'));
        return true;
      }
    );
  });

  it('throws on 404 not found', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ message: 'Not Found' }),
    }));
    await assert.rejects(
      () => getTool('linear_list_teams').handler({}),
      (err) => {
        assert.ok(err.message.includes('Linear API 404'));
        return true;
      }
    );
  });

  it('throws on 429 rate limited', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 429,
      text: async () => 'Too Many Requests',
      json: async () => ({ message: 'Rate limited' }),
    }));
    await assert.rejects(
      () => getTool('linear_search').handler({ query: 'test' }),
      (err) => {
        assert.ok(err.message.includes('Linear API 429'));
        return true;
      }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ message: 'Server Error' }),
    }));
    await assert.rejects(
      () => getTool('linear_list_projects').handler({}),
      (err) => {
        assert.ok(err.message.includes('Linear API 500'));
        return true;
      }
    );
  });

  it('throws on GraphQL error response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      json: async () => ({ errors: [{ message: 'Cannot query field "foo"' }] }),
      text: async () => '{}',
    }));
    await assert.rejects(
      () => getTool('linear_list_teams').handler({}),
      (err) => {
        assert.ok(err.message.includes('Cannot query field'));
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Empty result sets
// ---------------------------------------------------------------------------
describe('linear empty results', () => {
  it('linear_search_issues returns message on empty nodes', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_search_issues').handler({});
    assert.equal(result, 'No issues found.');
  });

  it('linear_get_issue returns not found for empty nodes', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_get_issue').handler({ identifier: 'ENG-999' });
    assert.ok(result.includes('not found'));
  });

  it('linear_list_projects returns message on empty nodes', async () => {
    mockGraphQL(200, { projects: { nodes: [] } });
    const result = await getTool('linear_list_projects').handler({});
    assert.equal(result, 'No projects found.');
  });

  it('linear_get_project returns not found for empty nodes', async () => {
    mockGraphQL(200, { projects: { nodes: [] } });
    const result = await getTool('linear_get_project').handler({ name: 'Ghost' });
    assert.ok(result.includes('not found'));
  });

  it('linear_list_teams returns message on empty nodes', async () => {
    mockGraphQL(200, { teams: { nodes: [] } });
    const result = await getTool('linear_list_teams').handler({});
    assert.equal(result, 'No teams found.');
  });

  it('linear_search returns message on empty nodes', async () => {
    mockGraphQL(200, { searchIssues: { nodes: [] } });
    const result = await getTool('linear_search').handler({ query: 'nothing' });
    assert.ok(result.includes('No results'));
  });

  it('linear_current_cycle returns message when no active cycle', async () => {
    mockGraphQL(200, { teams: { nodes: [{ activeCycle: null }] } });
    const result = await getTool('linear_current_cycle').handler({ teamKey: 'ENG' });
    assert.ok(result.includes('No active cycle'));
  });
});

// ---------------------------------------------------------------------------
// Special characters in input strings
// ---------------------------------------------------------------------------
describe('linear special characters in inputs', () => {
  it('linear_search handles special chars in query', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { searchIssues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search').handler({ query: 'bug & fix <tag> "quoted"' });
    assert.ok(capturedBody.query.includes('bug & fix <tag> "quoted"'));
  });

  it('linear_add_comment passes special chars in body via variables', async () => {
    let callCount = 0;
    let capturedVars;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { issues: { nodes: [{ id: 'issue-1' }] } } }),
          text: async () => '{}',
        };
      }
      capturedVars = body.variables;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { commentCreate: { comment: { id: 'c1' } } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_add_comment').handler({ identifier: 'ENG-1', body: 'Fix for <div> & "quote" issue' });
    assert.equal(capturedVars.body, 'Fix for <div> & "quote" issue');
  });

  it('linear_create_issue passes title with special chars via variables', async () => {
    let callCount = 0;
    let capturedVars;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { teams: { nodes: [{ id: 'team-1' }] } } }),
          text: async () => '{}',
        };
      }
      capturedVars = body.variables;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueCreate: { issue: { identifier: 'ENG-99', title: 'Fix <tag> & "stuff"', state: { name: 'Todo' } } } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_create_issue').handler({ title: 'Fix <tag> & "stuff"', teamKey: 'ENG' });
    assert.equal(capturedVars.title, 'Fix <tag> & "stuff"');
  });
});

// ---------------------------------------------------------------------------
// Complex input schemas — multiple filters
// ---------------------------------------------------------------------------
describe('linear complex inputs', () => {
  it('linear_search_issues builds filter with all params', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search_issues').handler({
      query: 'login', teamKey: 'ENG', status: 'In Progress', assignee: 'Alice', limit: 10,
    });
    assert.ok(capturedBody.query.includes('team: { key: { eq: "ENG" } }'));
    assert.ok(capturedBody.query.includes('state: { name: { eq: "In Progress" } }'));
    assert.ok(capturedBody.query.includes('assignee: { name: { contains: "Alice" } }'));
    assert.ok(capturedBody.query.includes('title: { contains: "login" }'));
    assert.ok(capturedBody.query.includes('first: 10'));
  });

  it('linear_create_issue sends all optional params', async () => {
    let callCount = 0;
    let capturedVars;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { teams: { nodes: [{ id: 'team-1' }] } } }),
          text: async () => '{}',
        };
      }
      if (callCount === 2) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { users: { nodes: [{ id: 'user-1' }] } } }),
          text: async () => '{}',
        };
      }
      capturedVars = body.variables;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueCreate: { issue: { identifier: 'ENG-200', title: 'Full issue', state: { name: 'Todo' } } } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_create_issue').handler({
      title: 'Full issue', teamKey: 'ENG', description: 'Detailed desc', priority: 2, assigneeName: 'Alice',
    });
    assert.equal(capturedVars.title, 'Full issue');
    assert.equal(capturedVars.description, 'Detailed desc');
    assert.equal(capturedVars.priority, 2);
    assert.equal(capturedVars.assigneeId, 'user-1');
  });
});

// ---------------------------------------------------------------------------
// Not-found graceful handling
// ---------------------------------------------------------------------------
describe('linear not-found graceful handling', () => {
  it('linear_create_issue returns error when team not found', async () => {
    mockGraphQL(200, { teams: { nodes: [] } });
    const result = await getTool('linear_create_issue').handler({ title: 'Test', teamKey: 'NOPE' });
    assert.ok(result.includes('not found'));
  });

  it('linear_update_issue returns not found for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_update_issue').handler({ identifier: 'ENG-999' });
    assert.ok(result.includes('not found'));
  });

  it('linear_change_status returns not found for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_change_status').handler({ identifier: 'ENG-999', status: 'Done' });
    assert.ok(result.includes('not found'));
  });

  it('linear_assign_issue returns not found for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_assign_issue').handler({ identifier: 'ENG-999', assigneeName: 'Alice' });
    assert.ok(result.includes('not found'));
  });

  it('linear_add_comment returns not found for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_add_comment').handler({ identifier: 'ENG-999', body: 'hi' });
    assert.ok(result.includes('not found'));
  });

  it('linear_change_status returns error for invalid status', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { issues: { nodes: [{ id: 'issue-1', team: { id: 'team-1' } }] } } }),
          text: async () => '{}',
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({ data: { workflowStates: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_change_status').handler({ identifier: 'ENG-1', status: 'NonexistentStatus' });
    assert.ok(result.includes('not found'));
  });

  it('linear_assign_issue returns error for unknown user', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { issues: { nodes: [{ id: 'issue-1' }] } } }),
          text: async () => '{}',
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({ data: { users: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_assign_issue').handler({ identifier: 'ENG-1', assigneeName: 'Nobody' });
    assert.ok(result.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
describe('linear default values', () => {
  it('linear_search_issues defaults limit to 20 in query', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_search_issues').handler({});
    assert.ok(capturedBody.query.includes('first: 20'));
  });

  it('linear_create_issue defaults description to empty string', async () => {
    let callCount = 0;
    let capturedVars;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { teams: { nodes: [{ id: 'team-1' }] } } }),
          text: async () => '{}',
        };
      }
      capturedVars = body.variables;
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueCreate: { issue: { identifier: 'ENG-51', title: 'Minimal', state: { name: 'Todo' } } } } }),
        text: async () => '{}',
      };
    });
    await getTool('linear_create_issue').handler({ title: 'Minimal', teamKey: 'ENG' });
    assert.equal(capturedVars.description, '');
  });
});
