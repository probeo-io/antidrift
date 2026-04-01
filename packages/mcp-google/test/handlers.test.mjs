import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis before importing any connector
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

// ===========================================================================
// CALENDAR
// ===========================================================================
describe('calendar_upcoming handler', () => {
  it('returns formatted events', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ summary: 'Standup', start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T09:30:00Z' }, id: 'e1' }] }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('Standup'));
    assert.ok(result.includes('[id: e1]'));
  });

  it('returns empty message', async () => {
    mockCalEvents = { list: async () => ({ data: { items: [] } }) };
    assert.equal(await getTool('calendar_upcoming').handler({}), 'No upcoming events.');
  });
});

describe('calendar_search handler', () => {
  it('returns matching events', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ summary: 'Design', start: { dateTime: '2026-04-01T14:00:00Z' }, end: { dateTime: '2026-04-01T15:00:00Z' }, id: 'e2' }] }
      })
    };
    const result = await getTool('calendar_search').handler({ query: 'Design' });
    assert.ok(result.includes('Design'));
  });

  it('returns empty when no matches', async () => {
    mockCalEvents = { list: async () => ({ data: { items: [] } }) };
    assert.equal(await getTool('calendar_search').handler({ query: 'nope' }), 'No events matching "nope".');
  });
});

describe('calendar_create handler', () => {
  it('creates event', async () => {
    mockCalEvents = {
      insert: async () => ({
        data: { summary: 'New', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e3' }
      })
    };
    const result = await getTool('calendar_create').handler({ title: 'New', start: '2026-04-01T10:00:00Z' });
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('New'));
  });
});

describe('calendar_today handler', () => {
  it('returns today events', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ summary: 'Today', start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T10:00:00Z' }, id: 'e4' }] }
      })
    };
    const result = await getTool('calendar_today').handler({});
    assert.ok(result.includes('Today'));
  });

  it('returns empty when nothing', async () => {
    mockCalEvents = { list: async () => ({ data: { items: [] } }) };
    assert.equal(await getTool('calendar_today').handler({}), 'Nothing on the calendar today.');
  });
});

// ===========================================================================
// GMAIL
// ===========================================================================
describe('gmail_search handler', () => {
  it('returns formatted messages', async () => {
    mockGmailMessages = {
      list: async () => ({ data: { messages: [{ id: 'm1' }] } }),
      get: async () => ({
        data: { payload: { headers: [
          { name: 'From', value: 'alice@test.com' },
          { name: 'Subject', value: 'Invoice' },
          { name: 'Date', value: '2026-03-30' },
        ] } }
      }),
    };
    const result = await getTool('gmail_search').handler({ query: 'invoice' });
    assert.ok(result.includes('Invoice'));
    assert.ok(result.includes('[id: m1]'));
  });

  it('returns empty message', async () => {
    mockGmailMessages = { list: async () => ({ data: {} }) };
    assert.equal(await getTool('gmail_search').handler({ query: 'x' }), 'No messages found.');
  });
});

describe('gmail_read handler', () => {
  it('returns message content', async () => {
    const body = Buffer.from('Hello').toString('base64url');
    mockGmailMessages = {
      get: async () => ({
        data: { payload: { headers: [
          { name: 'Subject', value: 'Test' },
          { name: 'From', value: 'a@b.com' },
          { name: 'To', value: 'c@d.com' },
          { name: 'Date', value: '2026-03-30' },
        ], body: { data: body } } }
      }),
    };
    const result = await getTool('gmail_read').handler({ messageId: 'm1' });
    assert.ok(result.includes('Subject: Test'));
    assert.ok(result.includes('Hello'));
  });
});

describe('gmail_send handler', () => {
  it('sends and returns confirmation', async () => {
    mockGmailMessages = {
      send: async () => ({ data: { id: 's1' } })
    };
    const result = await getTool('gmail_send').handler({ to: 'x@y.com', subject: 'Hi', body: 'Body' });
    assert.ok(result.includes('Sent to x@y.com'));
  });
});

describe('gmail_list_labels handler', () => {
  it('returns labels', async () => {
    mockGmailLabels = {
      list: async () => ({ data: { labels: [{ name: 'Work', id: 'L1' }] } })
    };
    const result = await getTool('gmail_list_labels').handler({});
    assert.ok(result.includes('Work'));
  });

  it('returns empty message', async () => {
    mockGmailLabels = { list: async () => ({ data: { labels: [] } }) };
    assert.equal(await getTool('gmail_list_labels').handler({}), 'No labels found.');
  });
});

describe('gmail_create_label handler', () => {
  it('creates label', async () => {
    mockGmailLabels = {
      create: async () => ({ data: { id: 'L2' } })
    };
    const result = await getTool('gmail_create_label').handler({ name: 'Urgent' });
    assert.ok(result.includes('Label created'));
    assert.ok(result.includes('Urgent'));
  });
});

describe('gmail_archive handler', () => {
  it('archives message', async () => {
    mockGmailMessages = { modify: async () => ({ data: {} }) };
    const result = await getTool('gmail_archive').handler({ messageId: 'm1' });
    assert.ok(result.includes('Archived'));
  });
});

describe('gmail_trash handler', () => {
  it('trashes message', async () => {
    mockGmailMessages = { trash: async () => ({ data: {} }) };
    const result = await getTool('gmail_trash').handler({ messageId: 'm1' });
    assert.ok(result.includes('Trashed'));
  });
});

describe('gmail_list_drafts handler', () => {
  it('returns drafts', async () => {
    mockGmailDrafts = {
      list: async () => ({ data: { drafts: [{ id: 'd1' }] } }),
      get: async () => ({
        data: { message: { payload: { headers: [
          { name: 'Subject', value: 'Draft' },
          { name: 'To', value: 'x@y.com' },
        ] } } }
      })
    };
    const result = await getTool('gmail_list_drafts').handler({});
    assert.ok(result.includes('Draft'));
    assert.ok(result.includes('[id: d1]'));
  });

  it('returns empty message', async () => {
    mockGmailDrafts = { list: async () => ({ data: {} }) };
    assert.equal(await getTool('gmail_list_drafts').handler({}), 'No drafts found.');
  });
});

// ===========================================================================
// DRIVE
// ===========================================================================
describe('drive_list_files handler', () => {
  it('returns files', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 'f1', name: 'Report.pdf', mimeType: 'application/pdf' }] } })
    };
    const result = await getTool('drive_list_files').handler({});
    assert.ok(result.includes('Report.pdf'));
    assert.ok(result.includes('[id: f1]'));
  });
});

describe('drive_get_file_info handler', () => {
  it('returns file metadata', async () => {
    mockDriveFiles = {
      get: async () => ({ data: { id: 'f1', name: 'Doc', mimeType: 'text/plain' } })
    };
    const result = await getTool('drive_get_file_info').handler({ fileId: 'f1' });
    assert.equal(result.name, 'Doc');
  });
});

describe('drive_create_folder handler', () => {
  it('creates folder', async () => {
    mockDriveFiles = {
      create: async () => ({ data: { id: 'fo1', name: 'New', webViewLink: 'https://x' } })
    };
    const result = await getTool('drive_create_folder').handler({ name: 'New' });
    assert.equal(result.id, 'fo1');
  });
});

describe('drive_share handler', () => {
  it('shares file', async () => {
    mockDrivePermissions = { create: async () => ({ data: {} }) };
    mockDriveFiles = { get: async () => ({ data: { name: 'File', webViewLink: 'https://x' } }) };
    const result = await getTool('drive_share').handler({ fileId: 'f1', email: 'bob@test.com' });
    assert.equal(result.shared, 'bob@test.com');
  });
});

// ===========================================================================
// DOCS
// ===========================================================================
describe('create_doc handler', () => {
  it('creates doc', async () => {
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc1' } }),
    };
    const result = await getTool('create_doc').handler({ title: 'My Doc' });
    assert.equal(result.id, 'doc1');
    assert.ok(result.url.includes('doc1'));
  });
});

describe('read_doc handler', () => {
  it('returns doc text', async () => {
    mockDocsDocuments = {
      get: async () => ({
        data: { title: 'Test', body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Hello' } }] } }] } }
      })
    };
    const result = await getTool('read_doc').handler({ documentId: 'doc1' });
    assert.equal(result.text, 'Hello');
  });
});

describe('list_docs handler', () => {
  it('returns doc list', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 'd1', name: 'Doc 1' }] } })
    };
    const result = await getTool('list_docs').handler({});
    assert.equal(result.length, 1);
  });
});

// ===========================================================================
// SHEETS
// ===========================================================================
describe('list_spreadsheets handler', () => {
  it('returns spreadsheets', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 's1', name: 'Budget' }] } })
    };
    const result = await getTool('list_spreadsheets').handler({});
    assert.equal(result[0].name, 'Budget');
  });
});

describe('read_sheet handler', () => {
  it('returns values', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({ data: { values: [['A', 'B']] } }),
        update: async () => ({}),
        append: async () => ({}),
      },
      get: async () => ({})
    };
    const result = await getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'A1:B1' });
    assert.deepEqual(result, [['A', 'B']]);
  });

  it('returns empty array when no values', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: {} }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    assert.deepEqual(await getTool('read_sheet').handler({ spreadsheetId: 's1', range: 'A1' }), []);
  });
});

describe('write_sheet handler', () => {
  it('writes and returns count', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async () => ({ data: { updatedCells: 2 } }),
        append: async () => ({}),
      },
      get: async () => ({})
    };
    const result = await getTool('write_sheet').handler({ spreadsheetId: 's1', range: 'A1', values: [['x', 'y']] });
    assert.equal(result.updatedCells, 2);
  });
});

describe('get_sheet_info handler', () => {
  it('returns metadata', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({
        data: {
          properties: { title: 'My Sheet' },
          sheets: [{ properties: { title: 'Sheet1', index: 0, gridProperties: { rowCount: 100, columnCount: 26 } } }]
        }
      })
    };
    const result = await getTool('get_sheet_info').handler({ spreadsheetId: 's1' });
    assert.equal(result.title, 'My Sheet');
    assert.equal(result.sheets[0].rowCount, 100);
  });
});

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

// ===========================================================================
// Error handling
// ===========================================================================
describe('error handling across connectors', () => {
  it('calendar API error propagates', async () => {
    mockCalEvents = { list: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => getTool('calendar_upcoming').handler({}));
  });

  it('gmail API error propagates', async () => {
    mockGmailMessages = { list: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => getTool('gmail_search').handler({ query: 'x' }));
  });

  it('drive API error propagates', async () => {
    mockDriveFiles = { list: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => getTool('drive_list_files').handler({}));
  });

  it('docs API error propagates', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => getTool('read_doc').handler({ documentId: 'bad' }));
  });

  it('sheets API error propagates', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => { throw new Error('API 500'); }, update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    await assert.rejects(() => getTool('read_sheet').handler({ spreadsheetId: 'bad', range: 'A1' }));
  });
});
