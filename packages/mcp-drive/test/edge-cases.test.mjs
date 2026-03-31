import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis
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
// Missing required parameters
// ---------------------------------------------------------------------------
describe('missing required parameters', () => {
  it('drive_get_file_info rejects when API throws', async () => {
    mockDriveFiles = { get: async () => { throw new Error('Not Found'); } };
    await assert.rejects(() => getTool('drive_get_file_info').handler({ fileId: undefined }));
  });

  it('read_doc rejects when documentId is invalid', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('Not Found'); } };
    await assert.rejects(() => getTool('read_doc').handler({ documentId: '' }));
  });

  it('read_sheet rejects when spreadsheetId is invalid', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => { throw new Error('Not Found'); }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => getTool('read_sheet').handler({ spreadsheetId: '', range: 'A1' }));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted
// ---------------------------------------------------------------------------
describe('optional parameters omitted', () => {
  it('drive_list_files with no params has no q filter', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('drive_list_files').handler({});
    assert.equal(captured.q, undefined);
    assert.equal(captured.pageSize, 20);
  });

  it('drive_list_folders with no query has only mimeType filter', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('drive_list_folders').handler({});
    assert.equal(captured.q, "mimeType = 'application/vnd.google-apps.folder'");
  });

  it('drive_share defaults role to reader', async () => {
    let permArgs;
    mockDrivePermissions = {
      create: async (args) => { permArgs = args; return { data: {} }; }
    };
    mockDriveFiles = {
      get: async () => ({ data: { name: 'F', webViewLink: 'https://x' } })
    };
    await getTool('drive_share').handler({ fileId: 'f1', email: 'x@y.com' });
    assert.equal(permArgs.requestBody.role, 'reader');
  });

  it('create_doc skips content and folder when not provided', async () => {
    let createCalled = false;
    let batchCalled = false;
    let updateCalled = false;
    mockDocsDocuments = {
      create: async () => { createCalled = true; return { data: { documentId: 'doc1' } }; },
      batchUpdate: async () => { batchCalled = true; return { data: {} }; },
    };
    mockDriveFiles = {
      get: async () => { updateCalled = true; return { data: { parents: ['root'] } }; },
      update: async () => { updateCalled = true; return { data: {} }; },
    };
    await getTool('create_doc').handler({ title: 'Empty' });
    assert.ok(createCalled);
    assert.ok(!batchCalled);
    assert.ok(!updateCalled);
  });

  it('list_spreadsheets uses default limit=20', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('list_spreadsheets').handler({});
    assert.equal(captured.pageSize, 20);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('error responses', () => {
  it('handles 401 from drive API', async () => {
    mockDriveFiles = { list: async () => { throw new Error('Request failed with status 401'); } };
    await assert.rejects(() => getTool('drive_list_files').handler({}));
  });

  it('handles 404 from docs API', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('Request failed with status 404'); } };
    await assert.rejects(() => getTool('read_doc').handler({ documentId: 'bad' }));
  });

  it('handles 429 rate limit from sheets API', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => { throw new Error('Request failed with status 429'); }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'A1' }));
  });

  it('handles 500 server error', async () => {
    mockDriveFiles = { create: async () => { throw new Error('Request failed with status 500'); } };
    await assert.rejects(() => getTool('drive_create_folder').handler({ name: 'Test' }));
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------
describe('empty results', () => {
  it('drive_list_files with empty files', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [] } })
    };
    const result = await getTool('drive_list_files').handler({});
    assert.equal(result, '');
  });

  it('drive_list_folders with empty files', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [] } })
    };
    const result = await getTool('drive_list_folders').handler({});
    assert.equal(result, '');
  });

  it('list_docs with empty files', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [] } })
    };
    const result = await getTool('list_docs').handler({});
    assert.deepEqual(result, []);
  });

  it('list_spreadsheets with empty files', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [] } })
    };
    const result = await getTool('list_spreadsheets').handler({});
    assert.deepEqual(result, []);
  });

  it('read_sheet with empty data', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: {} }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    const result = await getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'A1' });
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// Special characters in inputs
// ---------------------------------------------------------------------------
describe('special characters in inputs', () => {
  it('drive_list_files passes special chars in query', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await getTool('drive_list_files').handler({ query: "John's Report" });
    assert.ok(captured.q.includes("John's Report"));
  });

  it('create_doc handles unicode in title', async () => {
    let capturedArgs;
    mockDocsDocuments = {
      create: async (args) => { capturedArgs = args; return { data: { documentId: 'doc1' } }; },
    };
    await getTool('create_doc').handler({ title: 'Ubersicht des Cafe\u0301s' });
    assert.equal(capturedArgs.requestBody.title, 'Ubersicht des Cafe\u0301s');
  });

  it('write_sheet handles special chars in values', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async (args) => { captured = args; return { data: { updatedCells: 1 } }; },
        append: async () => ({}),
      },
      get: async () => ({})
    };
    await getTool('write_sheet').handler({ spreadsheetId: 's1', range: 'A1', values: [['=SUM(A1:A10)', '<html>&amp;']] });
    assert.deepEqual(captured.resource.values, [['=SUM(A1:A10)', '<html>&amp;']]);
  });

  it('drive_create_folder handles special chars in name', async () => {
    let capturedArgs;
    mockDriveFiles = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'f1', name: 'Test & "Demo"' } }; }
    };
    await getTool('drive_create_folder').handler({ name: 'Test & "Demo"' });
    assert.equal(capturedArgs.requestBody.name, 'Test & "Demo"');
  });
});
