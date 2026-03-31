import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
let mockCalEvents;
let mockGmailMessages, mockGmailLabels, mockGmailDrafts;
let mockDriveFiles, mockDrivePermissions;
let mockDocsDocuments;
let mockSheetsSpreadsheets;

const fakeCalendar = () => ({
  events: {
    list: (...a) => mockCalEvents.list(...a),
    insert: (...a) => mockCalEvents.insert(...a),
  }
});

const fakeGmail = () => ({
  users: {
    messages: {
      list: (...a) => mockGmailMessages.list(...a),
      get: (...a) => mockGmailMessages.get(...a),
      send: (...a) => mockGmailMessages.send(...a),
      modify: (...a) => mockGmailMessages.modify(...a),
      trash: (...a) => mockGmailMessages.trash(...a),
    },
    labels: {
      list: (...a) => mockGmailLabels.list(...a),
      create: (...a) => mockGmailLabels.create(...a),
    },
    drafts: {
      list: (...a) => mockGmailDrafts.list(...a),
      get: (...a) => mockGmailDrafts.get(...a),
      create: (...a) => mockGmailDrafts.create(...a),
    },
  }
});

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
      calendar: fakeCalendar,
      gmail: fakeGmail,
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

const calMod = await import('../connectors/google-calendar.mjs');
const gmailMod = await import('../connectors/google-gmail.mjs');
const driveMod = await import('../connectors/google-drive.mjs');
const docsMod = await import('../connectors/google-docs.mjs');
const sheetsMod = await import('../connectors/google-sheets.mjs');

const allTools = [...calMod.tools, ...gmailMod.tools, ...driveMod.tools, ...docsMod.tools, ...sheetsMod.tools];
const toolMap = Object.fromEntries(allTools.map(t => [t.name, t]));
function getTool(name) { return toolMap[name]; }

afterEach(() => {
  mockCalEvents = {};
  mockGmailMessages = {}; mockGmailLabels = {}; mockGmailDrafts = {};
  mockDriveFiles = {}; mockDrivePermissions = {};
  mockDocsDocuments = {};
  mockSheetsSpreadsheets = { values: {} };
});

// ---------------------------------------------------------------------------
// Missing required parameters
// ---------------------------------------------------------------------------
describe('missing required parameters', () => {
  it('calendar_create throws when start is invalid', async () => {
    mockCalEvents = { insert: async () => { throw new Error('Invalid date'); } };
    await assert.rejects(() => getTool('calendar_create').handler({ title: 'No Start' }));
  });

  it('gmail_read throws for missing messageId', async () => {
    mockGmailMessages = { get: async () => { throw new Error('Not Found'); } };
    await assert.rejects(() => getTool('gmail_read').handler({ messageId: undefined }));
  });

  it('drive_get_file_info throws for missing fileId', async () => {
    mockDriveFiles = { get: async () => { throw new Error('Not Found'); } };
    await assert.rejects(() => getTool('drive_get_file_info').handler({ fileId: undefined }));
  });

  it('read_doc throws for missing documentId', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('Not Found'); } };
    await assert.rejects(() => getTool('read_doc').handler({ documentId: '' }));
  });

  it('read_sheet throws for missing spreadsheetId', async () => {
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
  it('calendar_upcoming defaults to 7 days and 20 limit', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await getTool('calendar_upcoming').handler({});
    assert.equal(captured.maxResults, 20);
  });

  it('gmail_search defaults to limit=10', async () => {
    let captured;
    mockGmailMessages = { list: async (args) => { captured = args; return { data: {} }; } };
    await getTool('gmail_search').handler({ query: 'test' });
    assert.equal(captured.maxResults, 10);
  });

  it('drive_list_files defaults to limit=20 with no q filter', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await getTool('drive_list_files').handler({});
    assert.equal(captured.pageSize, 20);
    assert.equal(captured.q, undefined);
  });

  it('create_doc skips content and folder when not provided', async () => {
    let batchCalled = false;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc1' } }),
      batchUpdate: async () => { batchCalled = true; return { data: {} }; },
    };
    await getTool('create_doc').handler({ title: 'Empty' });
    assert.ok(!batchCalled);
  });

  it('list_spreadsheets defaults to limit=20', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await getTool('list_spreadsheets').handler({});
    assert.equal(captured.pageSize, 20);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('error responses', () => {
  it('calendar 401', async () => {
    mockCalEvents = { list: async () => { throw new Error('401'); } };
    await assert.rejects(() => getTool('calendar_upcoming').handler({}));
  });

  it('gmail 404', async () => {
    mockGmailMessages = { get: async () => { throw new Error('404'); } };
    await assert.rejects(() => getTool('gmail_read').handler({ messageId: 'bad' }));
  });

  it('drive 429', async () => {
    mockDriveFiles = { list: async () => { throw new Error('429'); } };
    await assert.rejects(() => getTool('drive_list_files').handler({}));
  });

  it('docs 500', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('500'); } };
    await assert.rejects(() => getTool('read_doc').handler({ documentId: 'bad' }));
  });

  it('sheets 500', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => { throw new Error('500'); }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => getTool('read_sheet').handler({ spreadsheetId: 'bad', range: 'A1' }));
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------
describe('empty results', () => {
  it('calendar_upcoming with null items', async () => {
    mockCalEvents = { list: async () => ({ data: {} }) };
    assert.equal(await getTool('calendar_upcoming').handler({}), 'No upcoming events.');
  });

  it('gmail_search with no messages', async () => {
    mockGmailMessages = { list: async () => ({ data: {} }) };
    assert.equal(await getTool('gmail_search').handler({ query: 'x' }), 'No messages found.');
  });

  it('gmail_list_labels with empty labels', async () => {
    mockGmailLabels = { list: async () => ({ data: { labels: [] } }) };
    assert.equal(await getTool('gmail_list_labels').handler({}), 'No labels found.');
  });

  it('drive_list_files with empty files', async () => {
    mockDriveFiles = { list: async () => ({ data: { files: [] } }) };
    assert.equal(await getTool('drive_list_files').handler({}), '');
  });

  it('list_docs with empty files', async () => {
    mockDriveFiles = { list: async () => ({ data: { files: [] } }) };
    assert.deepEqual(await getTool('list_docs').handler({}), []);
  });

  it('read_sheet with no values', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: {} }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    assert.deepEqual(await getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'A1' }), []);
  });

  it('list_spreadsheets with empty files', async () => {
    mockDriveFiles = { list: async () => ({ data: { files: [] } }) };
    assert.deepEqual(await getTool('list_spreadsheets').handler({}), []);
  });

  it('gmail_list_drafts with null drafts', async () => {
    mockGmailDrafts = { list: async () => ({ data: {} }) };
    assert.equal(await getTool('gmail_list_drafts').handler({}), 'No drafts found.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in inputs
// ---------------------------------------------------------------------------
describe('special characters in inputs', () => {
  it('calendar_search passes special chars', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await getTool('calendar_search').handler({ query: "meeting's <agenda>" });
    assert.equal(captured.q, "meeting's <agenda>");
  });

  it('gmail_search passes complex query', async () => {
    let captured;
    mockGmailMessages = { list: async (args) => { captured = args; return { data: {} }; } };
    await getTool('gmail_search').handler({ query: 'from:"O\'Brien" subject:(re: hello)' });
    assert.equal(captured.q, 'from:"O\'Brien" subject:(re: hello)');
  });

  it('drive_list_files passes special chars in query', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await getTool('drive_list_files').handler({ query: "John's Report" });
    assert.ok(captured.q.includes("John's Report"));
  });

  it('create_doc handles unicode in title', async () => {
    let captured;
    mockDocsDocuments = {
      create: async (args) => { captured = args; return { data: { documentId: 'doc1' } }; },
    };
    await getTool('create_doc').handler({ title: '\u00dcbersicht des Caf\u00e9s' });
    assert.equal(captured.requestBody.title, '\u00dcbersicht des Caf\u00e9s');
  });

  it('write_sheet handles formula-like values', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async (args) => { captured = args; return { data: { updatedCells: 1 } }; },
        append: async () => ({}),
      },
      get: async () => ({})
    };
    await getTool('write_sheet').handler({ spreadsheetId: 's1', range: 'A1', values: [['=SUM(A1:A10)']] });
    assert.deepEqual(captured.resource.values, [['=SUM(A1:A10)']]);
  });

  it('calendar event with no title shows (No title)', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T10:00:00Z' }, id: 'e99' }] }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('(No title)'));
  });
});
