import { describe, it, before } from 'node:test';
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

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

const EXPECTED_TOOLS = [
  'clickup_list_workspaces', 'clickup_list_spaces', 'clickup_list_folders', 'clickup_list_lists',
  'clickup_list_tasks', 'clickup_get_task', 'clickup_create_task', 'clickup_update_task',
  'clickup_add_comment', 'clickup_search_tasks', 'clickup_list_statuses', 'clickup_move_task',
];

describe('clickup tool definitions', () => {
  it('exports a non-empty tools array', () => {
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
  });

  it('has expected tool count', () => {
    assert.equal(tools.length, EXPECTED_TOOLS.length);
  });

  it('has all expected tools', () => {
    const names = tools.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`);
    }
  });

  it('has no duplicate tool names', () => {
    const names = tools.map(t => t.name);
    assert.equal(names.length, new Set(names).size);
  });

  it('all tool names start with clickup_ prefix', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('clickup_'), `Tool ${tool.name} missing clickup_ prefix`);
    }
  });

  it('every tool has name, description, inputSchema, handler', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.name, 'string');
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.inputSchema);
      assert.equal(tool.inputSchema.type, 'object');
      assert.ok(typeof tool.inputSchema.properties === 'object');
      assert.equal(typeof tool.handler, 'function');
    }
  });

  it('required fields exist in properties', () => {
    for (const tool of tools) {
      if (tool.inputSchema.required) {
        for (const field of tool.inputSchema.required) {
          assert.ok(tool.inputSchema.properties[field], `Tool ${tool.name} requires '${field}' not in properties`);
        }
      }
    }
  });
});
