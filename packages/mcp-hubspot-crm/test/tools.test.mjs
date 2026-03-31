import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'hubspot.json');
const BACKUP_PATH = CONFIG_PATH + '.crm-tools-test-backup';

let tools;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ accessToken: 'test-fake-token' }));

  const mod = await import('../connectors/hubspot-crm.mjs');
  tools = mod.tools;

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

const EXPECTED_TOOLS = [
  'hubspot_list_contacts', 'hubspot_get_contact', 'hubspot_create_contact', 'hubspot_update_contact',
  'hubspot_list_companies', 'hubspot_get_company', 'hubspot_create_company', 'hubspot_update_company',
  'hubspot_list_deals', 'hubspot_get_deal', 'hubspot_create_deal', 'hubspot_update_deal',
  'hubspot_add_note', 'hubspot_list_activities',
  'hubspot_search',
  'hubspot_list_leads', 'hubspot_get_lead', 'hubspot_create_lead', 'hubspot_update_lead',
  'hubspot_list_forecasts', 'hubspot_list_line_items',
];

describe('hubspot-crm tool definitions', () => {
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

  it('CRUD tools have correct required fields', () => {
    const toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
    // Create tools require at least one field
    assert.deepEqual(toolMap['hubspot_create_contact'].inputSchema.required, ['email']);
    assert.deepEqual(toolMap['hubspot_create_company'].inputSchema.required, ['name']);
    assert.deepEqual(toolMap['hubspot_create_deal'].inputSchema.required, ['name']);
    assert.deepEqual(toolMap['hubspot_create_lead'].inputSchema.required, ['email']);
    // Update tools require ID + properties
    assert.deepEqual(toolMap['hubspot_update_contact'].inputSchema.required, ['contactId', 'properties']);
    assert.deepEqual(toolMap['hubspot_update_company'].inputSchema.required, ['companyId', 'properties']);
    assert.deepEqual(toolMap['hubspot_update_deal'].inputSchema.required, ['dealId', 'properties']);
    assert.deepEqual(toolMap['hubspot_update_lead'].inputSchema.required, ['leadId', 'properties']);
    // Get tools require an ID
    assert.deepEqual(toolMap['hubspot_get_contact'].inputSchema.required, ['contactId']);
    assert.deepEqual(toolMap['hubspot_get_company'].inputSchema.required, ['companyId']);
    assert.deepEqual(toolMap['hubspot_get_deal'].inputSchema.required, ['dealId']);
    assert.deepEqual(toolMap['hubspot_get_lead'].inputSchema.required, ['leadId']);
  });
});
