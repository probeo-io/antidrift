/**
 * Comprehensive unit tests for mcp-drive zeromcp tool files.
 *
 * Tests three layers:
 *   1. Structure — each tools/*.mjs exports valid { description, input, execute }
 *   2. Execute behaviour — tools wired to a mocked googleapis drive/docs/sheets client
 *   3. Input schema validation — required fields, types, optional fields
 *
 * mcp-drive has no pure formatting functions (unlike calendar/gmail), so
 * the bulk of testing is structure + execute.
 */

import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis and auth-google BEFORE any tool files are imported
// ---------------------------------------------------------------------------
let mockDriveFiles       = {};
let mockDrivePermissions = {};
let mockDocsDocuments    = {};
let mockSheetsSpreadsheets = { values: {} };

const fakeDrive = () => ({
  files: {
    list:   (...a) => mockDriveFiles.list(...a),
    get:    (...a) => mockDriveFiles.get(...a),
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
    create:      (...a) => mockDocsDocuments.create(...a),
    get:         (...a) => mockDocsDocuments.get(...a),
    batchUpdate: (...a) => mockDocsDocuments.batchUpdate(...a),
  }
});

const fakeSheets = () => ({
  spreadsheets: {
    get:         (...a) => mockSheetsSpreadsheets.get(...a),
    create:      (...a) => mockSheetsSpreadsheets.create(...a),
    batchUpdate: (...a) => mockSheetsSpreadsheets.batchUpdate(...a),
    values: {
      get:    (...a) => mockSheetsSpreadsheets.values.get(...a),
      update: (...a) => mockSheetsSpreadsheets.values.update(...a),
      append: (...a) => mockSheetsSpreadsheets.values.append(...a),
    }
  }
});

await mock.module('googleapis', {
  namedExports: {
    google: {
      drive:  fakeDrive,
      docs:   fakeDocs,
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

// Import tool files after mocks are installed
const driveListFilesMod    = await import('../tools/drive_list_files.mjs');
const driveListFoldersMod  = await import('../tools/drive_list_folders.mjs');
const driveGetFileInfoMod  = await import('../tools/drive_get_file_info.mjs');
const driveCreateFolderMod = await import('../tools/drive_create_folder.mjs');
const driveMoveFileMod     = await import('../tools/drive_move_file.mjs');
const driveShareMod        = await import('../tools/drive_share.mjs');
const driveDownloadMod     = await import('../tools/drive_download.mjs');
const readDocMod           = await import('../tools/read_doc.mjs');
const writeDocMod          = await import('../tools/write_doc.mjs');
const appendToDocMod       = await import('../tools/append_to_doc.mjs');
const createDocMod         = await import('../tools/create_doc.mjs');
const listDocsMod          = await import('../tools/list_docs.mjs');
const shareDocMod          = await import('../tools/share_doc.mjs');
const readSheetMod         = await import('../tools/read_sheet.mjs');
const writeSheetMod        = await import('../tools/write_sheet.mjs');
const appendSheetMod       = await import('../tools/append_sheet.mjs');
const createSpreadsheetMod = await import('../tools/create_spreadsheet.mjs');
const listSpreadsheetsMod  = await import('../tools/list_spreadsheets.mjs');
const addSheetMod          = await import('../tools/add_sheet.mjs');
const getSheetInfoMod      = await import('../tools/get_sheet_info.mjs');

const driveListFiles    = driveListFilesMod.default;
const driveListFolders  = driveListFoldersMod.default;
const driveGetFileInfo  = driveGetFileInfoMod.default;
const driveCreateFolder = driveCreateFolderMod.default;
const driveMoveFile     = driveMoveFileMod.default;
const driveShare        = driveShareMod.default;
const driveDownload     = driveDownloadMod.default;
const readDoc           = readDocMod.default;
const writeDoc          = writeDocMod.default;
const appendToDoc       = appendToDocMod.default;
const createDoc         = createDocMod.default;
const listDocs          = listDocsMod.default;
const shareDoc          = shareDocMod.default;
const readSheet         = readSheetMod.default;
const writeSheet        = writeSheetMod.default;
const appendSheet       = appendSheetMod.default;
const createSpreadsheet = createSpreadsheetMod.default;
const listSpreadsheets  = listSpreadsheetsMod.default;
const addSheet          = addSheetMod.default;
const getSheetInfo      = getSheetInfoMod.default;

const ctx = { credentials: {} };

afterEach(() => {
  mockDriveFiles = {};
  mockDrivePermissions = {};
  mockDocsDocuments = {};
  mockSheetsSpreadsheets = { values: {} };
});

// ===========================================================================
// 1. STRUCTURE TESTS
// ===========================================================================
describe('zeromcp tool structure', () => {
  const allTools = [
    { name: 'drive_list_files',    mod: driveListFiles },
    { name: 'drive_list_folders',  mod: driveListFolders },
    { name: 'drive_get_file_info', mod: driveGetFileInfo },
    { name: 'drive_create_folder', mod: driveCreateFolder },
    { name: 'drive_move_file',     mod: driveMoveFile },
    { name: 'drive_share',         mod: driveShare },
    { name: 'drive_download',      mod: driveDownload },
    { name: 'read_doc',            mod: readDoc },
    { name: 'write_doc',           mod: writeDoc },
    { name: 'append_to_doc',       mod: appendToDoc },
    { name: 'create_doc',          mod: createDoc },
    { name: 'list_docs',           mod: listDocs },
    { name: 'share_doc',           mod: shareDoc },
    { name: 'read_sheet',          mod: readSheet },
    { name: 'write_sheet',         mod: writeSheet },
    { name: 'append_sheet',        mod: appendSheet },
    { name: 'create_spreadsheet',  mod: createSpreadsheet },
    { name: 'list_spreadsheets',   mod: listSpreadsheets },
    { name: 'add_sheet',           mod: addSheet },
    { name: 'get_sheet_info',      mod: getSheetInfo },
  ];

  for (const { name, mod } of allTools) {
    it(`${name}: exports a non-null default`, () => {
      assert.ok(mod, `${name} default export is falsy`);
    });

    it(`${name}: description is a non-empty string`, () => {
      assert.equal(typeof mod.description, 'string');
      assert.ok(mod.description.length > 0);
    });

    it(`${name}: input is an object`, () => {
      assert.equal(typeof mod.input, 'object');
      assert.ok(mod.input !== null);
    });

    it(`${name}: execute is a function`, () => {
      assert.equal(typeof mod.execute, 'function');
    });
  }

  // Required field checks
  it('drive_get_file_info: fileId is required string', () => {
    assert.equal(driveGetFileInfo.input.fileId?.type, 'string');
    assert.ok(driveGetFileInfo.input.fileId && driveGetFileInfo.input.fileId?.optional !== true);
  });

  it('drive_create_folder: name is required, parentId is optional', () => {
    assert.equal(driveCreateFolder.input.name?.type, 'string');
    assert.ok(driveCreateFolder.input.name && driveCreateFolder.input.name?.optional !== true);
    assert.equal(driveCreateFolder.input.parentId?.type, 'string');
    assert.ok(driveCreateFolder.input.parentId?.optional === true);
  });

  it('drive_move_file: fileId and folderId are required strings', () => {
    assert.equal(driveMoveFile.input.fileId?.type, 'string');
    assert.ok(driveMoveFile.input.fileId && driveMoveFile.input.fileId?.optional !== true);
    assert.equal(driveMoveFile.input.folderId?.type, 'string');
    assert.ok(driveMoveFile.input.folderId && driveMoveFile.input.folderId?.optional !== true);
  });

  it('drive_share: fileId and email are required, role is optional', () => {
    assert.equal(driveShare.input.fileId?.type, 'string');
    assert.ok(driveShare.input.fileId && driveShare.input.fileId?.optional !== true);
    assert.equal(driveShare.input.email?.type, 'string');
    assert.ok(driveShare.input.email && driveShare.input.email?.optional !== true);
    assert.equal(driveShare.input.role?.type, 'string');
    assert.ok(driveShare.input.role?.optional === true);
  });

  it('drive_download: fileId and outputPath are required, format is optional', () => {
    assert.equal(driveDownload.input.fileId?.type, 'string');
    assert.ok(driveDownload.input.fileId && driveDownload.input.fileId?.optional !== true);
    assert.equal(driveDownload.input.outputPath?.type, 'string');
    assert.ok(driveDownload.input.outputPath && driveDownload.input.outputPath?.optional !== true);
    assert.equal(driveDownload.input.format?.type, 'string');
    assert.ok(driveDownload.input.format?.optional === true);
  });

  it('read_doc: documentId is required string', () => {
    assert.equal(readDoc.input.documentId?.type, 'string');
    assert.ok(readDoc.input.documentId && readDoc.input.documentId?.optional !== true);
  });

  it('write_doc: documentId and content are required', () => {
    assert.equal(writeDoc.input.documentId?.type, 'string');
    assert.ok(writeDoc.input.documentId && writeDoc.input.documentId?.optional !== true);
    assert.equal(writeDoc.input.content?.type, 'string');
    assert.ok(writeDoc.input.content && writeDoc.input.content?.optional !== true);
  });

  it('append_to_doc: documentId and text are required', () => {
    assert.equal(appendToDoc.input.documentId?.type, 'string');
    assert.ok(appendToDoc.input.documentId && appendToDoc.input.documentId?.optional !== true);
    assert.equal(appendToDoc.input.text?.type, 'string');
    assert.ok(appendToDoc.input.text && appendToDoc.input.text?.optional !== true);
  });

  it('create_doc: title is required, content and folderId are optional', () => {
    assert.equal(createDoc.input.title?.type, 'string');
    assert.ok(createDoc.input.title && createDoc.input.title?.optional !== true);
    assert.equal(createDoc.input.content?.type, 'string');
    assert.ok(createDoc.input.content?.optional === true);
    assert.equal(createDoc.input.folderId?.type, 'string');
    assert.ok(createDoc.input.folderId?.optional === true);
  });

  it('read_sheet: spreadsheetId and range are required', () => {
    assert.equal(readSheet.input.spreadsheetId?.type, 'string');
    assert.ok(readSheet.input.spreadsheetId && readSheet.input.spreadsheetId?.optional !== true);
    assert.equal(readSheet.input.range?.type, 'string');
    assert.ok(readSheet.input.range && readSheet.input.range?.optional !== true);
  });

  it('write_sheet: spreadsheetId, range, and values are required', () => {
    assert.equal(writeSheet.input.spreadsheetId?.type, 'string');
    assert.ok(writeSheet.input.spreadsheetId && writeSheet.input.spreadsheetId?.optional !== true);
    assert.equal(writeSheet.input.range?.type, 'string');
    assert.ok(writeSheet.input.range && writeSheet.input.range?.optional !== true);
    assert.equal(writeSheet.input.values?.type, 'array');
    assert.ok(writeSheet.input.values && writeSheet.input.values?.optional !== true);
  });

  it('append_sheet: spreadsheetId, range, and values are required', () => {
    assert.equal(appendSheet.input.spreadsheetId?.type, 'string');
    assert.ok(appendSheet.input.spreadsheetId && appendSheet.input.spreadsheetId?.optional !== true);
    assert.equal(appendSheet.input.range?.type, 'string');
    assert.ok(appendSheet.input.range && appendSheet.input.range?.optional !== true);
    assert.equal(appendSheet.input.values?.type, 'array');
    assert.ok(appendSheet.input.values && appendSheet.input.values?.optional !== true);
  });

  it('create_spreadsheet: title is required, sheets is optional array', () => {
    assert.equal(createSpreadsheet.input.title?.type, 'string');
    assert.ok(createSpreadsheet.input.title && createSpreadsheet.input.title?.optional !== true);
    assert.equal(createSpreadsheet.input.sheets?.type, 'array');
    assert.ok(createSpreadsheet.input.sheets?.optional === true);
  });

  it('add_sheet: spreadsheetId and title are required', () => {
    assert.equal(addSheet.input.spreadsheetId?.type, 'string');
    assert.ok(addSheet.input.spreadsheetId && addSheet.input.spreadsheetId?.optional !== true);
    assert.equal(addSheet.input.title?.type, 'string');
    assert.ok(addSheet.input.title && addSheet.input.title?.optional !== true);
  });

  it('get_sheet_info: spreadsheetId is required', () => {
    assert.equal(getSheetInfo.input.spreadsheetId?.type, 'string');
    assert.ok(getSheetInfo.input.spreadsheetId && getSheetInfo.input.spreadsheetId?.optional !== true);
  });

  it('share_doc: documentId and email are required, role is optional', () => {
    assert.equal(shareDoc.input.documentId?.type, 'string');
    assert.ok(shareDoc.input.documentId && shareDoc.input.documentId?.optional !== true);
    assert.equal(shareDoc.input.email?.type, 'string');
    assert.ok(shareDoc.input.email && shareDoc.input.email?.optional !== true);
    assert.equal(shareDoc.input.role?.type, 'string');
    assert.ok(shareDoc.input.role?.optional === true);
  });
});

// ===========================================================================
// 2. EXECUTE TESTS — Drive files
// ===========================================================================
describe('drive_list_files.execute', () => {
  it('returns formatted file list with icons', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: {
          files: [
            { id: 'f1', name: 'Report.pdf',  mimeType: 'application/pdf' },
            { id: 'f2', name: 'Notes',       mimeType: 'application/vnd.google-apps.document' },
            { id: 'f3', name: 'Budget',      mimeType: 'application/vnd.google-apps.spreadsheet' },
          ]
        }
      })
    };
    const result = await driveListFiles.execute({}, ctx);
    assert.ok(result.includes('Report.pdf'));
    assert.ok(result.includes('[id: f1]'));
    assert.ok(result.includes('Notes'));
    assert.ok(result.includes('[id: f2]'));
    assert.ok(result.includes('Budget'));
    assert.ok(result.includes('[id: f3]'));
  });

  it('passes query, folderId, mimeType filters to API', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await driveListFiles.execute({ query: 'report', folderId: 'f1', mimeType: 'application/pdf', limit: 5 }, ctx);
    assert.ok(captured.q.includes("name contains 'report'"));
    assert.ok(captured.q.includes("'f1' in parents"));
    assert.ok(captured.q.includes("mimeType = 'application/pdf'"));
    assert.equal(captured.pageSize, 5);
  });

  it('passes no q filter when no search params provided', async () => {
    let captured;
    mockDriveFiles = {
      list: async (args) => { captured = args; return { data: { files: [] } }; }
    };
    await driveListFiles.execute({}, ctx);
    assert.equal(captured.q, undefined);
    assert.equal(captured.pageSize, 20);
  });

  it('uses generic paperclip icon for unknown mime types', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [{ id: 'f4', name: 'Unknown', mimeType: 'application/octet-stream' }] }
      })
    };
    const result = await driveListFiles.execute({}, ctx);
    assert.ok(result.includes('📎'));
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { list: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => driveListFiles.execute({}, ctx));
  });
});

describe('drive_list_folders.execute', () => {
  it('returns formatted folder list', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [{ id: 'fo1', name: 'Projects' }, { id: 'fo2', name: 'Archive' }] }
      })
    };
    const result = await driveListFolders.execute({}, ctx);
    assert.ok(result.includes('Projects'));
    assert.ok(result.includes('[id: fo1]'));
    assert.ok(result.includes('Archive'));
  });

  it('always includes mimeType folder filter', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await driveListFolders.execute({}, ctx);
    assert.ok(captured.q.includes("mimeType = 'application/vnd.google-apps.folder'"));
  });

  it('adds name and parent filters when provided', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await driveListFolders.execute({ query: 'work', parentId: 'root1' }, ctx);
    assert.ok(captured.q.includes("name contains 'work'"));
    assert.ok(captured.q.includes("'root1' in parents"));
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { list: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => driveListFolders.execute({}, ctx));
  });
});

describe('drive_get_file_info.execute', () => {
  it('returns file metadata object', async () => {
    mockDriveFiles = {
      get: async () => ({
        data: { id: 'f1', name: 'MyDoc', mimeType: 'text/plain', size: '1024' }
      })
    };
    const result = await driveGetFileInfo.execute({ fileId: 'f1' }, ctx);
    assert.equal(result.id, 'f1');
    assert.equal(result.name, 'MyDoc');
    assert.equal(result.mimeType, 'text/plain');
  });

  it('requests correct fields', async () => {
    let captured;
    mockDriveFiles = { get: async (args) => { captured = args; return { data: {} }; } };
    await driveGetFileInfo.execute({ fileId: 'f1' }, ctx);
    assert.ok(captured.fields.includes('id'));
    assert.ok(captured.fields.includes('name'));
    assert.ok(captured.fields.includes('mimeType'));
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => driveGetFileInfo.execute({ fileId: 'bad' }, ctx));
  });
});

describe('drive_create_folder.execute', () => {
  it('creates folder and returns data', async () => {
    let capturedArgs;
    mockDriveFiles = {
      create: async (args) => {
        capturedArgs = args;
        return { data: { id: 'fo3', name: 'New Folder', webViewLink: 'https://x' } };
      }
    };
    const result = await driveCreateFolder.execute({ name: 'New Folder' }, ctx);
    assert.equal(result.id, 'fo3');
    assert.equal(capturedArgs.requestBody.mimeType, 'application/vnd.google-apps.folder');
    assert.equal(capturedArgs.requestBody.name, 'New Folder');
  });

  it('includes parents array when parentId provided', async () => {
    let capturedArgs;
    mockDriveFiles = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'fo4', name: 'Sub' } }; }
    };
    await driveCreateFolder.execute({ name: 'Sub', parentId: 'parent1' }, ctx);
    assert.deepEqual(capturedArgs.requestBody.parents, ['parent1']);
  });

  it('omits parents when parentId not provided', async () => {
    let capturedArgs;
    mockDriveFiles = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'fo5', name: 'Root' } }; }
    };
    await driveCreateFolder.execute({ name: 'Root' }, ctx);
    assert.equal(capturedArgs.requestBody.parents, undefined);
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { create: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => driveCreateFolder.execute({ name: 'F' }, ctx));
  });
});

describe('drive_move_file.execute', () => {
  it('moves file from old to new folder', async () => {
    let updateArgs;
    mockDriveFiles = {
      get: async () => ({ data: { parents: ['old-folder'], name: 'File.txt' } }),
      update: async (args) => { updateArgs = args; return { data: { id: 'f1', name: 'File.txt', parents: ['new-folder'] } }; }
    };
    const result = await driveMoveFile.execute({ fileId: 'f1', folderId: 'new-folder' }, ctx);
    assert.equal(updateArgs.addParents, 'new-folder');
    assert.equal(updateArgs.removeParents, 'old-folder');
    assert.equal(result.id, 'f1');
  });

  it('handles multiple current parents', async () => {
    let updateArgs;
    mockDriveFiles = {
      get: async () => ({ data: { parents: ['p1', 'p2'], name: 'File' } }),
      update: async (args) => { updateArgs = args; return { data: { id: 'f2', name: 'File' } }; }
    };
    await driveMoveFile.execute({ fileId: 'f2', folderId: 'dest' }, ctx);
    assert.equal(updateArgs.removeParents, 'p1,p2');
  });

  it('propagates API errors from get', async () => {
    mockDriveFiles = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => driveMoveFile.execute({ fileId: 'bad', folderId: 'f' }, ctx));
  });
});

describe('drive_share.execute', () => {
  it('shares file and returns confirmation', async () => {
    let permArgs;
    mockDrivePermissions = { create: async (args) => { permArgs = args; return { data: {} }; } };
    mockDriveFiles = { get: async () => ({ data: { name: 'Report', webViewLink: 'https://drive.google.com/file/123' } }) };
    const result = await driveShare.execute({ fileId: 'f1', email: 'bob@test.com', role: 'writer' }, ctx);
    assert.equal(result.shared, 'bob@test.com');
    assert.equal(result.role, 'writer');
    assert.equal(result.name, 'Report');
    assert.ok(result.url.includes('drive.google.com'));
    assert.equal(permArgs.requestBody.emailAddress, 'bob@test.com');
    assert.equal(permArgs.requestBody.type, 'user');
  });

  it('defaults role to "reader" when not provided', async () => {
    let permArgs;
    mockDrivePermissions = { create: async (args) => { permArgs = args; return { data: {} }; } };
    mockDriveFiles = { get: async () => ({ data: { name: 'F', webViewLink: 'https://x' } }) };
    const result = await driveShare.execute({ fileId: 'f1', email: 'x@y.com' }, ctx);
    assert.equal(result.role, 'reader');
    assert.equal(permArgs.requestBody.role, 'reader');
  });

  it('propagates API errors from permissions.create', async () => {
    mockDrivePermissions = { create: async () => { throw new Error('API 403'); } };
    mockDriveFiles = { get: async () => ({ data: { name: 'F', webViewLink: 'x' } }) };
    await assert.rejects(() => driveShare.execute({ fileId: 'f1', email: 'x@y.com' }, ctx));
  });
});

describe('drive_download.execute', () => {
  it('returns error object for unsupported export format', async () => {
    mockDriveFiles = {
      get: async () => ({ data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc' } })
    };
    const result = await driveDownload.execute({ fileId: 'f1', outputPath: '/tmp/out.mp3', format: 'mp3' }, ctx);
    assert.ok(result.error);
    assert.ok(result.error.includes('mp3'));
  });

  it('propagates API errors from files.get', async () => {
    mockDriveFiles = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => driveDownload.execute({ fileId: 'bad', outputPath: '/tmp/out.pdf' }, ctx));
  });
});

// ===========================================================================
// 3. EXECUTE TESTS — Docs
// ===========================================================================
describe('create_doc.execute', () => {
  it('creates doc and returns id and url', async () => {
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc1' } }),
    };
    const result = await createDoc.execute({ title: 'My Doc' }, ctx);
    assert.equal(result.id, 'doc1');
    assert.ok(result.url.includes('doc1'));
    assert.ok(result.url.includes('docs.google.com'));
  });

  it('inserts content via batchUpdate when content is provided', async () => {
    let batchArgs;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc2' } }),
      batchUpdate: async (args) => { batchArgs = args; return { data: {} }; },
    };
    await createDoc.execute({ title: 'Doc', content: 'Hello world' }, ctx);
    assert.equal(batchArgs.requestBody.requests[0].insertText.text, 'Hello world');
    assert.equal(batchArgs.requestBody.requests[0].insertText.location.index, 1);
  });

  it('skips batchUpdate when no content', async () => {
    let batchCalled = false;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc3' } }),
      batchUpdate: async () => { batchCalled = true; return { data: {} }; },
    };
    await createDoc.execute({ title: 'Empty' }, ctx);
    assert.ok(!batchCalled);
  });

  it('moves to folder when folderId provided', async () => {
    let updateArgs;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc4' } }),
    };
    mockDriveFiles = {
      get: async () => ({ data: { parents: ['root'] } }),
      update: async (args) => { updateArgs = args; return { data: {} }; },
    };
    await createDoc.execute({ title: 'Doc', folderId: 'folder1' }, ctx);
    assert.equal(updateArgs.addParents, 'folder1');
    assert.equal(updateArgs.removeParents, 'root');
  });

  it('skips folder move when no folderId', async () => {
    let updateCalled = false;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc5' } }),
    };
    mockDriveFiles = {
      update: async () => { updateCalled = true; return { data: {} }; },
    };
    await createDoc.execute({ title: 'Doc' }, ctx);
    assert.ok(!updateCalled);
  });

  it('propagates API errors from documents.create', async () => {
    mockDocsDocuments = { create: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => createDoc.execute({ title: 'Bad' }, ctx));
  });
});

describe('read_doc.execute', () => {
  it('returns doc title and extracted text', async () => {
    mockDocsDocuments = {
      get: async () => ({
        data: {
          title: 'Test Doc',
          body: {
            content: [
              { paragraph: { elements: [{ textRun: { content: 'Hello ' } }, { textRun: { content: 'world' } }] } },
              { paragraph: { elements: [{ textRun: { content: '\nSecond line' } }] } }
            ]
          }
        }
      })
    };
    const result = await readDoc.execute({ documentId: 'doc1' }, ctx);
    assert.equal(result.title, 'Test Doc');
    assert.equal(result.text, 'Hello world\nSecond line');
  });

  it('handles elements without textRun gracefully', async () => {
    mockDocsDocuments = {
      get: async () => ({
        data: {
          title: 'Doc',
          body: {
            content: [
              { paragraph: { elements: [{ inlineObjectElement: {} }, { textRun: { content: 'text' } }] } }
            ]
          }
        }
      })
    };
    const result = await readDoc.execute({ documentId: 'doc1' }, ctx);
    assert.equal(result.text, 'text');
  });

  it('propagates API errors', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => readDoc.execute({ documentId: 'bad' }, ctx));
  });
});

describe('append_to_doc.execute', () => {
  it('appends text at end of doc and returns appended char count', async () => {
    let batchArgs;
    mockDocsDocuments = {
      get: async () => ({ data: { body: { content: [{ endIndex: 50 }] } } }),
      batchUpdate: async (args) => { batchArgs = args; return { data: {} }; },
    };
    const result = await appendToDoc.execute({ documentId: 'doc1', text: 'Appended text' }, ctx);
    assert.equal(batchArgs.requestBody.requests[0].insertText.location.index, 49);
    assert.equal(batchArgs.requestBody.requests[0].insertText.text, 'Appended text');
    assert.equal(result.documentId, 'doc1');
    assert.ok(result.appended.includes('13'));
  });

  it('propagates API errors from documents.get', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => appendToDoc.execute({ documentId: 'bad', text: 'T' }, ctx));
  });
});

describe('list_docs.execute', () => {
  it('returns array of doc objects', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [{ id: 'd1', name: 'Doc 1' }, { id: 'd2', name: 'Doc 2' }] }
      })
    };
    const result = await listDocs.execute({}, ctx);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Doc 1');
  });

  it('always includes mimeType filter for docs', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listDocs.execute({}, ctx);
    assert.ok(captured.q.includes("mimeType='application/vnd.google-apps.document'"));
  });

  it('adds query and folderId filters when provided', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listDocs.execute({ query: 'report', folderId: 'f1' }, ctx);
    assert.ok(captured.q.includes("name contains 'report'"));
    assert.ok(captured.q.includes("'f1' in parents"));
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { list: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => listDocs.execute({}, ctx));
  });
});

describe('share_doc.execute', () => {
  it('shares doc and returns confirmation', async () => {
    let permArgs;
    mockDrivePermissions = { create: async (args) => { permArgs = args; return { data: {} }; } };
    const result = await shareDoc.execute({ documentId: 'doc1', email: 'bob@test.com' }, ctx);
    assert.equal(result.shared, 'bob@test.com');
    assert.ok(result.url.includes('doc1'));
    assert.equal(permArgs.fileId, 'doc1');
    assert.equal(permArgs.requestBody.emailAddress, 'bob@test.com');
  });

  it('defaults role to writer', async () => {
    let permArgs;
    mockDrivePermissions = { create: async (args) => { permArgs = args; return { data: {} }; } };
    const result = await shareDoc.execute({ documentId: 'doc1', email: 'x@y.com' }, ctx);
    assert.equal(result.role, 'writer');
    assert.equal(permArgs.requestBody.role, 'writer');
  });

  it('propagates API errors', async () => {
    mockDrivePermissions = { create: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => shareDoc.execute({ documentId: 'd', email: 'x@y.com' }, ctx));
  });
});

// ===========================================================================
// 4. EXECUTE TESTS — Sheets
// ===========================================================================
describe('read_sheet.execute', () => {
  it('returns sheet values as array of arrays', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: { values: [['A', 'B'], ['1', '2']] } }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    const result = await readSheet.execute({ spreadsheetId: 's1', range: 'Sheet1!A1:B2' }, ctx);
    assert.deepEqual(result, [['A', 'B'], ['1', '2']]);
  });

  it('returns empty array when no values in range', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: {} }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    const result = await readSheet.execute({ spreadsheetId: 's1', range: 'Sheet1' }, ctx);
    assert.deepEqual(result, []);
  });

  it('passes spreadsheetId and range to API', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: { get: async (args) => { captured = args; return { data: { values: [] } }; }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await readSheet.execute({ spreadsheetId: 'sp1', range: 'Sheet2!A1:Z100' }, ctx);
    assert.equal(captured.spreadsheetId, 'sp1');
    assert.equal(captured.range, 'Sheet2!A1:Z100');
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => { throw new Error('API 404'); }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => readSheet.execute({ spreadsheetId: 'bad', range: 'A1' }, ctx));
  });
});

describe('write_sheet.execute', () => {
  it('writes data and returns updatedCells count', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async (args) => { captured = args; return { data: { updatedCells: 4 } }; },
        append: async () => ({})
      },
      get: async () => ({})
    };
    const result = await writeSheet.execute({ spreadsheetId: 's1', range: 'Sheet1!A1', values: [['a', 'b'], ['c', 'd']] }, ctx);
    assert.equal(result.updatedCells, 4);
    assert.equal(captured.valueInputOption, 'USER_ENTERED');
    assert.deepEqual(captured.resource.values, [['a', 'b'], ['c', 'd']]);
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => { throw new Error('API 400'); }, append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => writeSheet.execute({ spreadsheetId: 's1', range: 'A1', values: [[1]] }, ctx));
  });
});

describe('append_sheet.execute', () => {
  it('appends rows and returns updatedRows count', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async () => ({}),
        append: async () => ({ data: { updates: { updatedRows: 3 } } })
      },
      get: async () => ({})
    };
    const result = await appendSheet.execute({ spreadsheetId: 's1', range: 'Sheet1', values: [['x'], ['y'], ['z']] }, ctx);
    assert.equal(result.updatedRows, 3);
  });

  it('passes correct params to API', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async () => ({}),
        append: async (args) => { captured = args; return { data: { updates: { updatedRows: 1 } } }; }
      },
      get: async () => ({})
    };
    await appendSheet.execute({ spreadsheetId: 'sp1', range: 'Sheet2', values: [['v']] }, ctx);
    assert.equal(captured.spreadsheetId, 'sp1');
    assert.equal(captured.range, 'Sheet2');
    assert.equal(captured.valueInputOption, 'USER_ENTERED');
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => { throw new Error('API 500'); } },
      get: async () => ({})
    };
    await assert.rejects(() => appendSheet.execute({ spreadsheetId: 'bad', range: 'A1', values: [[1]] }, ctx));
  });
});

describe('create_spreadsheet.execute', () => {
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
    const result = await createSpreadsheet.execute({ title: 'Budget 2026' }, ctx);
    assert.equal(result.spreadsheetId, 'sp1');
    assert.equal(result.title, 'Budget 2026');
    assert.ok(result.url.includes('sp1'));
    assert.deepEqual(result.sheets, ['Sheet1']);
  });

  it('passes custom sheet names as resource to API', async () => {
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
            sheets: [{ properties: { title: 'Revenue' } }, { properties: { title: 'Costs' } }]
          }
        };
      },
      batchUpdate: async () => ({})
    };
    const result = await createSpreadsheet.execute({ title: 'Multi', sheets: ['Revenue', 'Costs'] }, ctx);
    assert.equal(captured.resource.sheets.length, 2);
    assert.equal(captured.resource.sheets[0].properties.title, 'Revenue');
    assert.deepEqual(result.sheets, ['Revenue', 'Costs']);
  });

  it('omits sheets from resource when not provided', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async (args) => {
        captured = args;
        return {
          data: {
            spreadsheetId: 'sp3',
            properties: { title: 'Default' },
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp3',
            sheets: [{ properties: { title: 'Sheet1' } }]
          }
        };
      },
      batchUpdate: async () => ({})
    };
    await createSpreadsheet.execute({ title: 'Default' }, ctx);
    assert.equal(captured.resource.sheets, undefined);
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => { throw new Error('API 400'); },
      batchUpdate: async () => ({})
    };
    await assert.rejects(() => createSpreadsheet.execute({ title: 'Bad' }, ctx));
  });
});

describe('list_spreadsheets.execute', () => {
  it('returns array of spreadsheet objects', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 's1', name: 'Budget' }, { id: 's2', name: 'Tracker' }] } })
    };
    const result = await listSpreadsheets.execute({}, ctx);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Budget');
  });

  it('always includes mimeType filter for spreadsheets', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listSpreadsheets.execute({}, ctx);
    assert.ok(captured.q.includes("mimeType='application/vnd.google-apps.spreadsheet'"));
  });

  it('adds name filter when query provided', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listSpreadsheets.execute({ query: 'budget' }, ctx);
    assert.ok(captured.q.includes("name contains 'budget'"));
  });

  it('defaults limit to 20', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listSpreadsheets.execute({}, ctx);
    assert.equal(captured.pageSize, 20);
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { list: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => listSpreadsheets.execute({}, ctx));
  });
});

describe('add_sheet.execute', () => {
  it('adds sheet and returns properties', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => ({}),
      batchUpdate: async () => ({
        data: { replies: [{ addSheet: { properties: { sheetId: 99, title: 'Q2', index: 1 } } }] }
      })
    };
    const result = await addSheet.execute({ spreadsheetId: 'sp1', title: 'Q2' }, ctx);
    assert.equal(result.sheetId, 99);
    assert.equal(result.title, 'Q2');
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
        return { data: { replies: [{ addSheet: { properties: { sheetId: 1, title: 'Tab', index: 0 } } }] } };
      }
    };
    await addSheet.execute({ spreadsheetId: 'sp1', title: 'Tab' }, ctx);
    assert.equal(captured.spreadsheetId, 'sp1');
    assert.deepEqual(captured.resource.requests, [{ addSheet: { properties: { title: 'Tab' } } }]);
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => ({}),
      batchUpdate: async () => { throw new Error('API 400'); }
    };
    await assert.rejects(() => addSheet.execute({ spreadsheetId: 'bad', title: 'Tab' }, ctx));
  });
});

describe('get_sheet_info.execute', () => {
  it('returns spreadsheet title and sheet metadata', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({
        data: {
          properties: { title: 'My Spreadsheet' },
          sheets: [
            { properties: { title: 'Sheet1', index: 0, gridProperties: { rowCount: 1000, columnCount: 26 } } },
            { properties: { title: 'Data',   index: 1, gridProperties: { rowCount: 500,  columnCount: 10 } } },
          ]
        }
      })
    };
    const result = await getSheetInfo.execute({ spreadsheetId: 'sp1' }, ctx);
    assert.equal(result.title, 'My Spreadsheet');
    assert.equal(result.sheets.length, 2);
    assert.equal(result.sheets[0].title, 'Sheet1');
    assert.equal(result.sheets[0].rowCount, 1000);
    assert.equal(result.sheets[0].columnCount, 26);
    assert.equal(result.sheets[1].title, 'Data');
    assert.equal(result.sheets[1].index, 1);
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => { throw new Error('API 404'); }
    };
    await assert.rejects(() => getSheetInfo.execute({ spreadsheetId: 'bad' }, ctx));
  });
});
