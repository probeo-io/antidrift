import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'linear.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

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
// Authentication
// ---------------------------------------------------------------------------
describe('linear authentication', () => {
  it('sends apiKey as Authorization header (no Bearer prefix)', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    await getTool('linear_search_issues').handler({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.headers['Authorization'], 'lin_test_fake_key');
  });

  it('sends POST to GraphQL endpoint', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    await getTool('linear_search_issues').handler({});
    const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(url, 'https://api.linear.app/graphql');
    assert.equal(opts.method, 'POST');
  });
});

// ---------------------------------------------------------------------------
// linear_search_issues
// ---------------------------------------------------------------------------
describe('linear_search_issues handler', () => {
  it('returns formatted issue list', async () => {
    mockGraphQL(200, {
      issues: {
        nodes: [
          { identifier: 'ENG-1', title: 'Fix login', state: { name: 'In Progress' }, priority: 2, assignee: { name: 'Alice' } },
          { identifier: 'ENG-2', title: 'Add tests', state: { name: 'Todo' }, priority: 3, assignee: null },
        ]
      }
    });
    const result = await getTool('linear_search_issues').handler({});
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Fix login'));
    assert.ok(result.includes('[In Progress]'));
    assert.ok(result.includes('(High)'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('ENG-2'));
    assert.ok(result.includes('(Medium)'));
  });

  it('returns message when no issues found', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_search_issues').handler({});
    assert.equal(result, 'No issues found.');
  });
});

// ---------------------------------------------------------------------------
// linear_get_issue
// ---------------------------------------------------------------------------
describe('linear_get_issue handler', () => {
  it('returns formatted issue details with comments', async () => {
    mockGraphQL(200, {
      issues: {
        nodes: [{
          identifier: 'ENG-42', title: 'Critical bug', description: 'App crashes on load',
          state: { name: 'In Progress' }, priority: 1,
          assignee: { name: 'Alice' }, creator: { name: 'Bob' },
          project: { name: 'Q1 Sprint' },
          labels: { nodes: [{ name: 'bug' }, { name: 'urgent' }] },
          comments: { nodes: [{ body: 'Looking into this', user: { name: 'Alice' }, createdAt: '2026-03-01T00:00:00Z' }] },
          createdAt: '2026-01-01', updatedAt: '2026-03-01',
        }]
      }
    });
    const result = await getTool('linear_get_issue').handler({ identifier: 'ENG-42' });
    assert.ok(result.includes('ENG-42'));
    assert.ok(result.includes('Critical bug'));
    assert.ok(result.includes('In Progress'));
    assert.ok(result.includes('Urgent'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('Bob'));
    assert.ok(result.includes('Q1 Sprint'));
    assert.ok(result.includes('bug'));
    assert.ok(result.includes('urgent'));
    assert.ok(result.includes('App crashes on load'));
    assert.ok(result.includes('Looking into this'));
    assert.ok(result.includes('Comments (1)'));
  });

  it('returns not found message for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_get_issue').handler({ identifier: 'ENG-999' });
    assert.ok(result.includes('ENG-999'));
    assert.ok(result.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// linear_create_issue
// ---------------------------------------------------------------------------
describe('linear_create_issue handler', () => {
  it('creates issue and returns confirmation', async () => {
    let callCount = 0;
    mock.method(globalThis, 'fetch', async () => {
      callCount++;
      if (callCount === 1) {
        // Get team ID
        return {
          ok: true, status: 200,
          json: async () => ({ data: { teams: { nodes: [{ id: 'team-1' }] } } }),
          text: async () => '{}',
        };
      }
      // Create issue
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueCreate: { issue: { identifier: 'ENG-100', title: 'New feature', state: { name: 'Todo' } } } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_create_issue').handler({ title: 'New feature', teamKey: 'ENG' });
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('ENG-100'));
    assert.ok(result.includes('New feature'));
  });

  it('returns error when team not found', async () => {
    mockGraphQL(200, { teams: { nodes: [] } });
    const result = await getTool('linear_create_issue').handler({ title: 'Test', teamKey: 'NOPE' });
    assert.ok(result.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// linear_update_issue
// ---------------------------------------------------------------------------
describe('linear_update_issue handler', () => {
  it('updates issue and returns confirmation', async () => {
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
        json: async () => ({ data: { issueUpdate: { issue: { identifier: 'ENG-1', title: 'Updated title', state: { name: 'In Progress' } } } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_update_issue').handler({ identifier: 'ENG-1', title: 'Updated title' });
    assert.ok(result.includes('Updated'));
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Updated title'));
  });

  it('returns not found for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_update_issue').handler({ identifier: 'ENG-999' });
    assert.ok(result.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// linear_change_status
// ---------------------------------------------------------------------------
describe('linear_change_status handler', () => {
  it('changes status and returns confirmation', async () => {
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
      if (callCount === 2) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { workflowStates: { nodes: [{ id: 'state-done', name: 'Done' }] } } }),
          text: async () => '{}',
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueUpdate: { issue: { identifier: 'ENG-1', title: 'Task', state: { name: 'Done' } } } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_change_status').handler({ identifier: 'ENG-1', status: 'Done' });
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Done'));
  });
});

// ---------------------------------------------------------------------------
// linear_assign_issue
// ---------------------------------------------------------------------------
describe('linear_assign_issue handler', () => {
  it('assigns issue and returns confirmation', async () => {
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
      if (callCount === 2) {
        return {
          ok: true, status: 200,
          json: async () => ({ data: { users: { nodes: [{ id: 'user-1', name: 'Alice' }] } } }),
          text: async () => '{}',
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({ data: { issueUpdate: { issue: { identifier: 'ENG-1' } } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_assign_issue').handler({ identifier: 'ENG-1', assigneeName: 'Alice' });
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Alice'));
  });
});

// ---------------------------------------------------------------------------
// linear_list_projects
// ---------------------------------------------------------------------------
describe('linear_list_projects handler', () => {
  it('returns formatted project list', async () => {
    mockGraphQL(200, {
      projects: {
        nodes: [
          { name: 'Q1 Sprint', state: 'started', progress: 0.65, lead: { name: 'Alice' } },
        ]
      }
    });
    const result = await getTool('linear_list_projects').handler({});
    assert.ok(result.includes('Q1 Sprint'));
    assert.ok(result.includes('[started]'));
    assert.ok(result.includes('65%'));
    assert.ok(result.includes('Alice'));
  });

  it('returns message when no projects', async () => {
    mockGraphQL(200, { projects: { nodes: [] } });
    const result = await getTool('linear_list_projects').handler({});
    assert.equal(result, 'No projects found.');
  });
});

// ---------------------------------------------------------------------------
// linear_get_project
// ---------------------------------------------------------------------------
describe('linear_get_project handler', () => {
  it('returns formatted project details with issues', async () => {
    mockGraphQL(200, {
      projects: {
        nodes: [{
          name: 'Q1 Sprint', state: 'started', progress: 0.65,
          lead: { name: 'Alice' }, startDate: '2026-01-01', targetDate: '2026-03-31',
          description: 'First quarter goals',
          issues: { nodes: [
            { identifier: 'ENG-1', title: 'Task 1', state: { name: 'Done' }, priority: 3, assignee: { name: 'Bob' } },
          ] },
        }]
      }
    });
    const result = await getTool('linear_get_project').handler({ name: 'Q1' });
    assert.ok(result.includes('Q1 Sprint'));
    assert.ok(result.includes('65%'));
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('First quarter goals'));
    assert.ok(result.includes('ENG-1'));
    assert.ok(result.includes('Task 1'));
  });

  it('returns not found message for missing project', async () => {
    mockGraphQL(200, { projects: { nodes: [] } });
    const result = await getTool('linear_get_project').handler({ name: 'Nonexistent' });
    assert.ok(result.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// linear_current_cycle
// ---------------------------------------------------------------------------
describe('linear_current_cycle handler', () => {
  it('returns formatted cycle with issues', async () => {
    mockGraphQL(200, {
      teams: {
        nodes: [{
          activeCycle: {
            number: 5, startsAt: '2026-03-01T00:00:00Z', endsAt: '2026-03-15T00:00:00Z',
            progress: 0.4,
            issues: { nodes: [
              { identifier: 'ENG-10', title: 'Sprint item', state: { name: 'In Progress' }, priority: 2, assignee: { name: 'Alice' } },
            ] },
          }
        }]
      }
    });
    const result = await getTool('linear_current_cycle').handler({ teamKey: 'ENG' });
    assert.ok(result.includes('Cycle 5'));
    assert.ok(result.includes('40%'));
    assert.ok(result.includes('ENG-10'));
    assert.ok(result.includes('Sprint item'));
  });

  it('returns message when no active cycle', async () => {
    mockGraphQL(200, { teams: { nodes: [{ activeCycle: null }] } });
    const result = await getTool('linear_current_cycle').handler({ teamKey: 'ENG' });
    assert.ok(result.includes('No active cycle'));
  });
});

// ---------------------------------------------------------------------------
// linear_list_teams
// ---------------------------------------------------------------------------
describe('linear_list_teams handler', () => {
  it('returns formatted team list', async () => {
    mockGraphQL(200, {
      teams: {
        nodes: [
          { key: 'ENG', name: 'Engineering', description: 'Eng team', issueCount: 150 },
          { key: 'DES', name: 'Design', description: 'Design team', issueCount: 30 },
        ]
      }
    });
    const result = await getTool('linear_list_teams').handler({});
    assert.ok(result.includes('ENG'));
    assert.ok(result.includes('Engineering'));
    assert.ok(result.includes('150 issues'));
    assert.ok(result.includes('DES'));
  });

  it('returns message when no teams', async () => {
    mockGraphQL(200, { teams: { nodes: [] } });
    const result = await getTool('linear_list_teams').handler({});
    assert.equal(result, 'No teams found.');
  });
});

// ---------------------------------------------------------------------------
// linear_add_comment
// ---------------------------------------------------------------------------
describe('linear_add_comment handler', () => {
  it('adds comment and returns confirmation', async () => {
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
        json: async () => ({ data: { commentCreate: { comment: { id: 'c1' } } } }),
        text: async () => '{}',
      };
    });
    const result = await getTool('linear_add_comment').handler({ identifier: 'ENG-1', body: 'Looks good!' });
    assert.ok(result.includes('Comment added'));
    assert.ok(result.includes('ENG-1'));
  });

  it('returns not found for missing issue', async () => {
    mockGraphQL(200, { issues: { nodes: [] } });
    const result = await getTool('linear_add_comment').handler({ identifier: 'ENG-999', body: 'hello' });
    assert.ok(result.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// linear_search
// ---------------------------------------------------------------------------
describe('linear_search handler', () => {
  it('returns formatted search results', async () => {
    mockGraphQL(200, {
      searchIssues: {
        nodes: [
          { identifier: 'ENG-5', title: 'Found issue', state: { name: 'Todo' }, priority: 4, assignee: null },
        ]
      }
    });
    const result = await getTool('linear_search').handler({ query: 'Found' });
    assert.ok(result.includes('ENG-5'));
    assert.ok(result.includes('Found issue'));
    assert.ok(result.includes('[Todo]'));
    assert.ok(result.includes('(Low)'));
  });

  it('returns message when no results', async () => {
    mockGraphQL(200, { searchIssues: { nodes: [] } });
    const result = await getTool('linear_search').handler({ query: 'nonexistent' });
    assert.ok(result.includes('No results'));
    assert.ok(result.includes('nonexistent'));
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('linear error handling', () => {
  it('throws on HTTP error response', async () => {
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

  it('throws on GraphQL error response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      json: async () => ({ errors: [{ message: 'Query too complex' }] }),
      text: async () => '{}',
    }));
    await assert.rejects(
      () => getTool('linear_list_teams').handler({}),
      (err) => {
        assert.ok(err.message.includes('Query too complex'));
        return true;
      }
    );
  });
});
