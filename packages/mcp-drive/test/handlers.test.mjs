import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis before importing the connectors
// ---------------------------------------------------------------------------
let mockDriveFiles, mockDrivePermissions;
let mockDocsDocuments;
let mockSheetsSpreadsheets;

const fakeDrive = () => ({
  files: {
    list: (...a) => mockDriveFiles.list(...a),
    get: (...a) => mockDriveFiles.get(...a),
    create: (...a) => mockDriveFiles.create(...a),
    update: (...a) => mockDriveFiles.update(...a),
    export: (...a) => mockDriveFiles.export(...a),
  },
  permissions: {
    create: (...a) => mockDrivePermissions.create(...a),
  }
});

const fakeDocs = () => ({
  documents: {
    create: (...a) => mockDocsDocuments.create(...a),
    get: (...a) => mockDocsDocuments.get(...a),
    batchUpdate: (...a) => mockDocsDocuments.batchUpdate(...a),
  }
});

const fakeSheets = () => ({
  spreadsheets: {
    get: (...a) => mockSheetsSpreadsheets.get(...a),
    create: (...a) => mockSheetsSpreadsheets.create(...a),
    batchUpdate: (...a) => mockSheetsSpreadsheets.batchUpdate(...a),
    values: {
      get: (...a) => mockSheetsSpreadsheets.values.get(...a),
      update: (...a) => mockSheetsSpreadsheets.values.update(...a),
      append: (...a) => mockSheetsSpreadsheets.values.append(...a),
    }
  }
});

await mock.module('googleapis', {
  namedExports: {
    google: {
      drive: fakeDrive,
      docs: fakeDocs,
      sheets: fakeSheets,
      auth: { OAuth2: class {} },
    }
  }
});

await mock.module('../auth-google.mjs', {
  namedExports: {
    getAuthClient: async () => ({}),
    hasToken: () => true,
  }
});

const drive = await import('../connectors/google-drive.mjs');
const docs = await import('../connectors/google-docs.mjs');
const sheets = await import('../connectors/google-sheets.mjs');
const allTools = [...drive.tools, ...sheets.tools, ...docs.tools];
const toolMap = Object.fromEntries(allTools.map(t => [t.name, t]));
function getTool(name) { return toolMap[name]; }

afterEach(() => {
  mockDriveFiles = {}; mockDrivePermissions = {};
  mockDocsDocuments = {};
  mockSheetsSpreadsheets = { values: {} };
});

// ---------------------------------------------------------------------------
// drive_list_files
// ---------------------------------------------------------------------------
describe('drive_list_files handler', () => {
  it('returns formatted file list', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: {
          files: [
            { id: 'f1', name: 'Report.pdf', mimeType: 'application/pdf' },
            { id: 'f2', name: 'Notes', mimeType: 'application/vnd.google-apps.document' },
          ]
        }
      })
    };
    const result = await getTool('drive_list_files').handler({});
    assert.ok(result.includes('Report.pdf'));
    assert.ok(result.includes('[id: f1]'));
    assert.ok(result.includes('Notes'));
    assert.ok(result.includes('[id: f2]'));
  });

  it('passes query and folderId to API', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('drive_list_files').handler({ query: 'report', folderId: 'folder1', limit: 5 });
    assert.ok(captured.q.includes("name contains 'report'"));
    assert.ok(captured.q.includes("'folder1' in parents"));
    assert.equal(captured.pageSize, 5);
  });
});

// ---------------------------------------------------------------------------
// drive_list_folders
// ---------------------------------------------------------------------------
describe('drive_list_folders handler', () => {
  it('returns formatted folder list', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [{ id: 'fo1', name: 'Projects' }] }
      })
    };
    const result = await getTool('drive_list_folders').handler({});
    assert.ok(result.includes('Projects'));
    assert.ok(result.includes('[id: fo1]'));
  });
});

// ---------------------------------------------------------------------------
// drive_get_file_info
// ---------------------------------------------------------------------------
describe('drive_get_file_info handler', () => {
  it('returns file metadata', async () => {
    mockDriveFiles = {
      get: async () => ({
        data: { id: 'f1', name: 'Doc', mimeType: 'text/plain', size: '1024' }
      })
    };
    const result = await getTool('drive_get_file_info').handler({ fileId: 'f1' });
    assert.equal(result.id, 'f1');
    assert.equal(result.name, 'Doc');
  });
});

// ---------------------------------------------------------------------------
// drive_share
// ---------------------------------------------------------------------------
describe('drive_share handler', () => {
  it('shares file and returns confirmation', async () => {
    let permArgs;
    mockDrivePermissions = {
      create: async (args) => { permArgs = args; return { data: {} }; }
    };
    mockDriveFiles = {
      get: async () => ({ data: { name: 'Report', webViewLink: 'https://drive.google.com/file/123' } })
    };
    const result = await getTool('drive_share').handler({ fileId: 'f1', email: 'bob@test.com', role: 'writer' });
    assert.equal(result.shared, 'bob@test.com');
    assert.equal(result.role, 'writer');
    assert.equal(permArgs.requestBody.emailAddress, 'bob@test.com');
    assert.equal(permArgs.requestBody.role, 'writer');
  });

  it('defaults role to reader', async () => {
    let permArgs;
    mockDrivePermissions = {
      create: async (args) => { permArgs = args; return { data: {} }; }
    };
    mockDriveFiles = {
      get: async () => ({ data: { name: 'Report', webViewLink: 'https://x' } })
    };
    const result = await getTool('drive_share').handler({ fileId: 'f1', email: 'bob@test.com' });
    assert.equal(result.role, 'reader');
    assert.equal(permArgs.requestBody.role, 'reader');
  });
});

// ---------------------------------------------------------------------------
// drive_create_folder
// ---------------------------------------------------------------------------
describe('drive_create_folder handler', () => {
  it('creates folder and returns data', async () => {
    let capturedArgs;
    mockDriveFiles = {
      create: async (args) => {
        capturedArgs = args;
        return { data: { id: 'fo2', name: 'New Folder', webViewLink: 'https://x' } };
      }
    };
    const result = await getTool('drive_create_folder').handler({ name: 'New Folder' });
    assert.equal(result.id, 'fo2');
    assert.equal(capturedArgs.requestBody.mimeType, 'application/vnd.google-apps.folder');
  });

  it('includes parentId when provided', async () => {
    let capturedArgs;
    mockDriveFiles = {
      create: async (args) => {
        capturedArgs = args;
        return { data: { id: 'fo3', name: 'Sub' } };
      }
    };
    await getTool('drive_create_folder').handler({ name: 'Sub', parentId: 'parent1' });
    assert.deepEqual(capturedArgs.requestBody.parents, ['parent1']);
  });
});

// ---------------------------------------------------------------------------
// drive_move_file
// ---------------------------------------------------------------------------
describe('drive_move_file handler', () => {
  it('moves file to new folder', async () => {
    let updateArgs;
    mockDriveFiles = {
      get: async () => ({ data: { parents: ['old-folder'], name: 'File' } }),
      update: async (args) => { updateArgs = args; return { data: { id: 'f1', name: 'File', parents: ['new-folder'] } }; }
    };
    const result = await getTool('drive_move_file').handler({ fileId: 'f1', folderId: 'new-folder' });
    assert.equal(updateArgs.addParents, 'new-folder');
    assert.equal(updateArgs.removeParents, 'old-folder');
    assert.equal(result.id, 'f1');
  });
});

// ---------------------------------------------------------------------------
// create_doc
// ---------------------------------------------------------------------------
describe('create_doc handler', () => {
  it('creates doc and returns url', async () => {
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc1' } }),
      batchUpdate: async () => ({ data: {} }),
    };
    const result = await getTool('create_doc').handler({ title: 'My Doc' });
    assert.equal(result.id, 'doc1');
    assert.ok(result.url.includes('doc1'));
  });

  it('inserts content when provided', async () => {
    let batchArgs;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc2' } }),
      batchUpdate: async (args) => { batchArgs = args; return { data: {} }; },
    };
    await getTool('create_doc').handler({ title: 'My Doc', content: 'Hello world' });
    assert.equal(batchArgs.requestBody.requests[0].insertText.text, 'Hello world');
  });

  it('moves to folder when folderId provided', async () => {
    let updateArgs;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc3' } }),
    };
    mockDriveFiles = {
      get: async () => ({ data: { parents: ['root'] } }),
      update: async (args) => { updateArgs = args; return { data: {} }; },
    };
    await getTool('create_doc').handler({ title: 'My Doc', folderId: 'folder1' });
    assert.equal(updateArgs.addParents, 'folder1');
    assert.equal(updateArgs.removeParents, 'root');
  });
});

// ---------------------------------------------------------------------------
// read_doc
// ---------------------------------------------------------------------------
describe('read_doc handler', () => {
  it('returns doc text', async () => {
    mockDocsDocuments = {
      get: async () => ({
        data: {
          title: 'Test Doc',
          body: {
            content: [
              { paragraph: { elements: [{ textRun: { content: 'Hello ' } }, { textRun: { content: 'world' } }] } }
            ]
          }
        }
      })
    };
    const result = await getTool('read_doc').handler({ documentId: 'doc1' });
    assert.equal(result.title, 'Test Doc');
    assert.equal(result.text, 'Hello world');
  });
});

// ---------------------------------------------------------------------------
// append_to_doc
// ---------------------------------------------------------------------------
describe('append_to_doc handler', () => {
  it('appends text at end of doc', async () => {
    let batchArgs;
    mockDocsDocuments = {
      get: async () => ({
        data: { body: { content: [{ endIndex: 50 }] } }
      }),
      batchUpdate: async (args) => { batchArgs = args; return { data: {} }; },
    };
    const result = await getTool('append_to_doc').handler({ documentId: 'doc1', text: 'Appended text' });
    assert.equal(batchArgs.requestBody.requests[0].insertText.location.index, 49);
    assert.equal(batchArgs.requestBody.requests[0].insertText.text, 'Appended text');
    assert.equal(result.documentId, 'doc1');
    assert.ok(result.appended.includes('13'));
  });
});

// ---------------------------------------------------------------------------
// list_docs
// ---------------------------------------------------------------------------
describe('list_docs handler', () => {
  it('returns docs list', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [{ id: 'd1', name: 'Doc 1' }, { id: 'd2', name: 'Doc 2' }] }
      })
    };
    const result = await getTool('list_docs').handler({});
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Doc 1');
  });

  it('filters by query and folderId', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('list_docs').handler({ query: 'report', folderId: 'f1' });
    assert.ok(captured.q.includes("name contains 'report'"));
    assert.ok(captured.q.includes("'f1' in parents"));
  });
});

// ---------------------------------------------------------------------------
// share_doc
// ---------------------------------------------------------------------------
describe('share_doc handler', () => {
  it('shares doc and returns url', async () => {
    mockDrivePermissions = {
      create: async () => ({ data: {} }),
    };
    const result = await getTool('share_doc').handler({ documentId: 'doc1', email: 'bob@test.com' });
    assert.equal(result.shared, 'bob@test.com');
    assert.ok(result.url.includes('doc1'));
  });
});

// ---------------------------------------------------------------------------
// Sheets: list_spreadsheets
// ---------------------------------------------------------------------------
describe('list_spreadsheets handler', () => {
  it('returns spreadsheet list', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [{ id: 's1', name: 'Budget', modifiedTime: '2026-03-30T00:00:00Z' }] }
      })
    };
    const result = await getTool('list_spreadsheets').handler({});
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Budget');
  });

  it('passes query filter to API', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('list_spreadsheets').handler({ query: 'budget' });
    assert.ok(captured.q.includes("name contains 'budget'"));
  });
});

// ---------------------------------------------------------------------------
// Sheets: read_sheet
// ---------------------------------------------------------------------------
describe('read_sheet handler', () => {
  it('returns sheet values', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({ data: { values: [['A', 'B'], ['1', '2']] } }),
        update: async () => ({}),
        append: async () => ({}),
      },
      get: async () => ({})
    };
    const result = await getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'Sheet1!A1:B2' });
    assert.deepEqual(result, [['A', 'B'], ['1', '2']]);
  });

  it('returns empty array when no values', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({ data: {} }),
        update: async () => ({}),
        append: async () => ({}),
      },
      get: async () => ({})
    };
    const result = await getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'Sheet1' });
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// Sheets: write_sheet
// ---------------------------------------------------------------------------
describe('write_sheet handler', () => {
  it('writes data and returns updated count', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async (args) => { captured = args; return { data: { updatedCells: 4 } }; },
        append: async () => ({}),
      },
      get: async () => ({})
    };
    const result = await getTool('write_sheet').handler({ spreadsheetId: 's1', range: 'Sheet1!A1', values: [['a', 'b'], ['c', 'd']] });
    assert.equal(result.updatedCells, 4);
    assert.equal(captured.valueInputOption, 'USER_ENTERED');
  });
});

// ---------------------------------------------------------------------------
// Sheets: append_sheet
// ---------------------------------------------------------------------------
describe('append_sheet handler', () => {
  it('appends rows and returns count', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async () => ({}),
        append: async () => ({ data: { updates: { updatedRows: 2 } } }),
      },
      get: async () => ({})
    };
    const result = await getTool('append_sheet').handler({ spreadsheetId: 's1', range: 'Sheet1', values: [['x'], ['y']] });
    assert.equal(result.updatedRows, 2);
  });
});

// ---------------------------------------------------------------------------
// Sheets: get_sheet_info
// ---------------------------------------------------------------------------
describe('get_sheet_info handler', () => {
  it('returns spreadsheet metadata', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({
        data: {
          properties: { title: 'My Sheet' },
          sheets: [
            { properties: { title: 'Sheet1', index: 0, gridProperties: { rowCount: 100, columnCount: 26 } } }
          ]
        }
      })
    };
    const result = await getTool('get_sheet_info').handler({ spreadsheetId: 's1' });
    assert.equal(result.title, 'My Sheet');
    assert.equal(result.sheets.length, 1);
    assert.equal(result.sheets[0].title, 'Sheet1');
    assert.equal(result.sheets[0].rowCount, 100);
  });
});

// ---------------------------------------------------------------------------
// Sheets: create_spreadsheet
// ---------------------------------------------------------------------------
describe('create_spreadsheet handler', () => {
  it('creates spreadsheet and returns metadata', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => ({
        data: {
          spreadsheetId: 'sp1',
          properties: { title: 'Budget 2026' },
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp1',
          sheets: [{ properties: { title: 'Sheet1' } }]
        }
      }),
      batchUpdate: async () => ({})
    };
    const result = await getTool('create_spreadsheet').handler({ title: 'Budget 2026' });
    assert.equal(result.spreadsheetId, 'sp1');
    assert.equal(result.title, 'Budget 2026');
    assert.ok(result.url.includes('sp1'));
    assert.deepEqual(result.sheets, ['Sheet1']);
  });

  it('passes custom sheet names to API', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async (args) => {
        captured = args;
        return {
          data: {
            spreadsheetId: 'sp2',
            properties: { title: 'Multi' },
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp2',
            sheets: [{ properties: { title: 'Revenue' } }, { properties: { title: 'Expenses' } }]
          }
        };
      },
      batchUpdate: async () => ({})
    };
    const result = await getTool('create_spreadsheet').handler({ title: 'Multi', sheets: ['Revenue', 'Expenses'] });
    assert.equal(captured.resource.sheets.length, 2);
    assert.equal(captured.resource.sheets[0].properties.title, 'Revenue');
    assert.deepEqual(result.sheets, ['Revenue', 'Expenses']);
  });
});

// ---------------------------------------------------------------------------
// Sheets: add_sheet
// ---------------------------------------------------------------------------
describe('add_sheet handler', () => {
  it('adds sheet and returns properties', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => ({}),
      batchUpdate: async () => ({
        data: {
          replies: [{ addSheet: { properties: { sheetId: 123, title: 'Q2 Data', index: 1 } } }]
        }
      })
    };
    const result = await getTool('add_sheet').handler({ spreadsheetId: 'sp1', title: 'Q2 Data' });
    assert.equal(result.sheetId, 123);
    assert.equal(result.title, 'Q2 Data');
    assert.equal(result.index, 1);
  });

  it('sends correct batchUpdate request', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => ({}),
      batchUpdate: async (args) => {
        captured = args;
        return {
          data: { replies: [{ addSheet: { properties: { sheetId: 456, title: 'New Tab', index: 2 } } }] }
        };
      }
    };
    await getTool('add_sheet').handler({ spreadsheetId: 'sp1', title: 'New Tab' });
    assert.equal(captured.spreadsheetId, 'sp1');
    assert.deepEqual(captured.resource.requests, [{ addSheet: { properties: { title: 'New Tab' } } }]);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('drive error handling', () => {
  it('propagates API errors from drive', async () => {
    mockDriveFiles = { list: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => getTool('drive_list_files').handler({}));
  });

  it('propagates API errors from docs', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => getTool('read_doc').handler({ documentId: 'bad' }));
  });

  it('propagates API errors from sheets', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => { throw new Error('API 500'); }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => getTool('read_sheet').handler({ spreadsheetId: 'bad', range: 'A1' }));
  });
});
