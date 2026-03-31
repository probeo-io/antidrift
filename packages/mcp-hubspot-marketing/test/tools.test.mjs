import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'hubspot.json');
const BACKUP_PATH = CONFIG_PATH + '.marketing-tools-test-backup';

let tools;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ accessToken: 'test-fake-token' }));

  const mod = await import('../connectors/hubspot-marketing.mjs');
  tools = mod.tools;

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

const EXPECTED_TOOLS = [
  'hubspot_list_marketing_emails', 'hubspot_get_marketing_email',
  'hubspot_list_campaigns', 'hubspot_get_campaign',
  'hubspot_list_forms', 'hubspot_get_form', 'hubspot_get_form_submissions',
  'hubspot_list_landing_pages',
  'hubspot_list_blog_posts', 'hubspot_get_blog_post',
];

describe('hubspot-marketing tool definitions', () => {
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

  it('all tool names start with hubspot_ prefix', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('hubspot_'), `Tool ${tool.name} missing hubspot_ prefix`);
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

  it('get/detail tools require an ID field', () => {
    const toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
    assert.deepEqual(toolMap['hubspot_get_marketing_email'].inputSchema.required, ['emailId']);
    assert.deepEqual(toolMap['hubspot_get_campaign'].inputSchema.required, ['campaignId']);
    assert.deepEqual(toolMap['hubspot_get_form'].inputSchema.required, ['formId']);
    assert.deepEqual(toolMap['hubspot_get_form_submissions'].inputSchema.required, ['formId']);
    assert.deepEqual(toolMap['hubspot_get_blog_post'].inputSchema.required, ['postId']);
  });
});
