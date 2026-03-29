import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let allTools = [];

before(async () => {
  const sheets = await import('../connectors/google-sheets.mjs');
  const docs = await import('../connectors/google-docs.mjs');
  const drive = await import('../connectors/google-drive.mjs');
  const gmail = await import('../connectors/google-gmail.mjs');
  const calendar = await import('../connectors/google-calendar.mjs');
  allTools = [...sheets.tools, ...docs.tools, ...drive.tools, ...gmail.tools, ...calendar.tools];
});

const EXPECTED_SHEETS = ['list_spreadsheets', 'read_sheet', 'write_sheet', 'append_sheet', 'get_sheet_info'];
const EXPECTED_DOCS = ['create_doc', 'read_doc', 'append_to_doc', 'write_doc', 'list_docs', 'share_doc'];
const EXPECTED_DRIVE = ['drive_list_files', 'drive_list_folders', 'drive_get_file_info', 'drive_download', 'drive_share', 'drive_create_folder', 'drive_move_file'];
const EXPECTED_GMAIL = ['gmail_search', 'gmail_read', 'gmail_send', 'gmail_reply', 'gmail_list_labels', 'gmail_create_label', 'gmail_add_label', 'gmail_remove_label', 'gmail_archive', 'gmail_trash', 'gmail_mark_read', 'gmail_mark_unread', 'gmail_list_drafts', 'gmail_create_draft'];
const EXPECTED_CALENDAR = ['calendar_upcoming', 'calendar_search', 'calendar_create', 'calendar_today'];
const ALL_EXPECTED = [...EXPECTED_SHEETS, ...EXPECTED_DOCS, ...EXPECTED_DRIVE, ...EXPECTED_GMAIL, ...EXPECTED_CALENDAR];

describe('google workspace tool definitions', () => {
  it('exports tools from all 5 connectors', () => {
    assert.ok(allTools.length > 0);
  });

  it('has expected total tool count', () => {
    assert.equal(allTools.length, ALL_EXPECTED.length, `Expected ${ALL_EXPECTED.length} tools, got ${allTools.length}`);
  });

  it('has all expected tools', () => {
    const names = allTools.map(t => t.name);
    for (const expected of ALL_EXPECTED) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`);
    }
  });

  it('has no duplicate tool names', () => {
    const names = allTools.map(t => t.name);
    assert.equal(names.length, new Set(names).size);
  });

  it('every tool has name, description, inputSchema, handler', () => {
    for (const tool of allTools) {
      assert.equal(typeof tool.name, 'string');
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.inputSchema);
      assert.equal(tool.inputSchema.type, 'object');
      assert.ok(typeof tool.inputSchema.properties === 'object');
      assert.equal(typeof tool.handler, 'function');
    }
  });

  it('required fields exist in properties', () => {
    for (const tool of allTools) {
      if (tool.inputSchema.required) {
        for (const field of tool.inputSchema.required) {
          assert.ok(tool.inputSchema.properties[field], `Tool ${tool.name} requires '${field}' not in properties`);
        }
      }
    }
  });

  it('all property types are valid JSON Schema types', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const tool of allTools) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        if (prop.type) {
          assert.ok(validTypes.includes(prop.type), `Tool ${tool.name}.${key} has invalid type: ${prop.type}`);
        }
      }
    }
  });
});

describe('sheets tools', () => {
  it('has correct count', () => {
    assert.equal(EXPECTED_SHEETS.length, 5);
  });
});

describe('docs tools', () => {
  it('has correct count', () => {
    assert.equal(EXPECTED_DOCS.length, 7);
  });
});

describe('drive tools', () => {
  it('has correct count', () => {
    assert.equal(EXPECTED_DRIVE.length, 7);
  });
});

describe('gmail tools', () => {
  it('has correct count', () => {
    assert.equal(EXPECTED_GMAIL.length, 14);
  });
});

describe('calendar tools', () => {
  it('has correct count', () => {
    assert.equal(EXPECTED_CALENDAR.length, 4);
  });
});
