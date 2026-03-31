import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'jira.json');
const BACKUP_PATH = CONFIG_PATH + '.test-backup';

let tools;

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

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

const EXPECTED_TOOLS = [
  'jira_list_projects',
  'jira_get_project',
  'jira_search_issues',
  'jira_get_issue',
  'jira_create_issue',
  'jira_update_issue',
  'jira_transition_issue',
  'jira_add_comment',
  'jira_assign_issue',
  'jira_list_statuses',
  'jira_list_users',
  'jira_list_sprints',
  'jira_list_boards',
  'jira_list_issue_types',
  'jira_my_issues',
];

describe('jira tool definitions', () => {
  it('exports a non-empty tools array', () => {
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
  });

  it('has expected tool count', () => {
    assert.equal(tools.length, EXPECTED_TOOLS.length, `Expected ${EXPECTED_TOOLS.length} tools, got ${tools.length}`);
  });

  it('has all expected tools', () => {
    const names = tools.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`);
    }
  });

  it('has no duplicate tool names', () => {
    const names = tools.map(t => t.name);
    const unique = new Set(names);
    assert.equal(names.length, unique.size, `Duplicate tools: ${names.filter((n, i) => names.indexOf(n) !== i)}`);
  });

  it('all tool names start with jira_ prefix', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('jira_'), `Tool ${tool.name} missing jira_ prefix`);
    }
  });

  it('every tool has a string name', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.name, 'string');
      assert.ok(tool.name.length > 0);
    }
  });

  it('every tool has a string description', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.description.length > 0);
    }
  });

  it('every tool has an inputSchema with type object', () => {
    for (const tool of tools) {
      assert.ok(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);
      assert.equal(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema.type is not 'object'`);
    }
  });

  it('every tool has a properties object in inputSchema', () => {
    for (const tool of tools) {
      assert.ok(typeof tool.inputSchema.properties === 'object', `Tool ${tool.name} missing inputSchema.properties`);
    }
  });

  it('every tool has a handler function', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.handler, 'function', `Tool ${tool.name} missing handler`);
    }
  });

  it('required fields exist in properties for each tool', () => {
    for (const tool of tools) {
      if (tool.inputSchema.required) {
        assert.ok(Array.isArray(tool.inputSchema.required), `Tool ${tool.name} required is not an array`);
        for (const field of tool.inputSchema.required) {
          assert.ok(
            tool.inputSchema.properties[field],
            `Tool ${tool.name} requires '${field}' but it is not in properties`
          );
        }
      }
    }
  });

  it('all property types are valid JSON Schema types', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const tool of tools) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        if (prop.type) {
          assert.ok(validTypes.includes(prop.type), `Tool ${tool.name}.${key} has invalid type: ${prop.type}`);
        }
      }
    }
  });

  it('all properties have descriptions', () => {
    for (const tool of tools) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        assert.ok(typeof prop.description === 'string', `Tool ${tool.name}.${key} missing description`);
      }
    }
  });

  it('jira_search_issues requires jql', () => {
    const tool = tools.find(t => t.name === 'jira_search_issues');
    assert.ok(tool.inputSchema.required.includes('jql'));
  });

  it('jira_create_issue requires projectKey and summary', () => {
    const tool = tools.find(t => t.name === 'jira_create_issue');
    assert.ok(tool.inputSchema.required.includes('projectKey'));
    assert.ok(tool.inputSchema.required.includes('summary'));
  });

  it('jira_get_issue requires issueKey', () => {
    const tool = tools.find(t => t.name === 'jira_get_issue');
    assert.ok(tool.inputSchema.required.includes('issueKey'));
  });

  it('jira_transition_issue requires issueKey and transitionName', () => {
    const tool = tools.find(t => t.name === 'jira_transition_issue');
    assert.ok(tool.inputSchema.required.includes('issueKey'));
    assert.ok(tool.inputSchema.required.includes('transitionName'));
  });

  it('jira_add_comment requires issueKey and body', () => {
    const tool = tools.find(t => t.name === 'jira_add_comment');
    assert.ok(tool.inputSchema.required.includes('issueKey'));
    assert.ok(tool.inputSchema.required.includes('body'));
  });

  it('jira_assign_issue requires issueKey and assigneeId', () => {
    const tool = tools.find(t => t.name === 'jira_assign_issue');
    assert.ok(tool.inputSchema.required.includes('issueKey'));
    assert.ok(tool.inputSchema.required.includes('assigneeId'));
  });

  it('jira_list_sprints requires boardId', () => {
    const tool = tools.find(t => t.name === 'jira_list_sprints');
    assert.ok(tool.inputSchema.required.includes('boardId'));
  });

  it('jira_list_boards has no required fields', () => {
    const tool = tools.find(t => t.name === 'jira_list_boards');
    assert.ok(!tool.inputSchema.required, 'jira_list_boards should have no required fields');
  });

  it('jira_my_issues has no required fields', () => {
    const tool = tools.find(t => t.name === 'jira_my_issues');
    assert.ok(!tool.inputSchema.required, 'jira_my_issues should have no required fields');
  });
});
