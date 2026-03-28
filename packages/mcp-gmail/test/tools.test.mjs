import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let tools;

before(async () => {
  const mod = await import('../connectors/google-gmail.mjs');
  tools = mod.tools;
});

const EXPECTED_TOOLS = [
  'gmail_search', 'gmail_read', 'gmail_send', 'gmail_reply',
  'gmail_list_labels', 'gmail_create_label', 'gmail_add_label', 'gmail_remove_label',
  'gmail_archive', 'gmail_trash', 'gmail_mark_read', 'gmail_mark_unread',
  'gmail_list_drafts', 'gmail_create_draft',
];

describe('gmail tool definitions', () => {
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

  it('all tool names start with gmail_ prefix', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('gmail_'), `Tool ${tool.name} missing gmail_ prefix`);
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
