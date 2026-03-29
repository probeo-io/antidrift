import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let allTools = [];

before(async () => {
  const drive = await import('../connectors/google-drive.mjs');
  const sheets = await import('../connectors/google-sheets.mjs');
  const docs = await import('../connectors/google-docs.mjs');
  allTools = [...drive.tools, ...sheets.tools, ...docs.tools];
});

const EXPECTED_DRIVE = ['drive_list_files', 'drive_list_folders', 'drive_get_file_info', 'drive_download', 'drive_share', 'drive_create_folder', 'drive_move_file'];
const EXPECTED_SHEETS = ['list_spreadsheets', 'read_sheet', 'write_sheet', 'append_sheet', 'get_sheet_info'];
const EXPECTED_DOCS = ['create_doc', 'read_doc', 'append_to_doc', 'write_doc', 'list_docs', 'share_doc'];
const ALL_EXPECTED = [...EXPECTED_DRIVE, ...EXPECTED_SHEETS, ...EXPECTED_DOCS];

describe('drive tool definitions', () => {
  it('exports tools from all 3 connectors', () => {
    assert.ok(allTools.length > 0);
  });

  it('has expected total tool count', () => {
    assert.equal(allTools.length, ALL_EXPECTED.length);
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
});
