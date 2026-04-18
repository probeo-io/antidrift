/**
 * Comprehensive unit tests for mcp-google zeromcp tool files.
 *
 * mcp-google is the unified Google Workspace package — it contains calendar,
 * gmail, drive, docs, and sheets tools all sharing a single lib/client.mjs
 * that exports createClient (with all five APIs), formatEvent, decodeBody,
 * and getHeader.
 *
 * Tests three layers:
 *   1. Structure — each tools/*.mjs exports valid { description, input, execute }
 *   2. Pure functions — formatEvent(), decodeBody(), getHeader() in lib/client.mjs
 *   3. Execute behaviour — tools wired to mocked googleapis clients
 */

import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis and auth-google BEFORE any tool files are imported
// ---------------------------------------------------------------------------
let mockCalEvents       = {};
let mockGmailMessages   = {};
let mockGmailLabels     = {};
let mockGmailDrafts     = {};
let mockDriveFiles      = {};
let mockDrivePerms      = {};
let mockDocsDocuments   = {};
let mockSheetsSpreadsheets = { values: {} };

const fakeCalendar = () => ({
  events: {
    list:   (...a) => mockCalEvents.list(...a),
    insert: (...a) => mockCalEvents.insert(...a),
  }
});

const fakeGmail = () => ({
  users: {
    messages: {
      list:   (...a) => mockGmailMessages.list(...a),
      get:    (...a) => mockGmailMessages.get(...a),
      send:   (...a) => mockGmailMessages.send(...a),
      modify: (...a) => mockGmailMessages.modify(...a),
      trash:  (...a) => mockGmailMessages.trash(...a),
    },
    labels: {
      list:   (...a) => mockGmailLabels.list(...a),
      create: (...a) => mockGmailLabels.create(...a),
    },
    drafts: {
      list:   (...a) => mockGmailDrafts.list(...a),
      get:    (...a) => mockGmailDrafts.get(...a),
      create: (...a) => mockGmailDrafts.create(...a),
    },
  }
});

const fakeDrive = () => ({
  files: {
    list:   (...a) => mockDriveFiles.list(...a),
    get:    (...a) => mockDriveFiles.get(...a),
    create: (...a) => mockDriveFiles.create(...a),
    update: (...a) => mockDriveFiles.update(...a),
    export: (...a) => mockDriveFiles.export(...a),
  },
  permissions: {
    create: (...a) => mockDrivePerms.create(...a),
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
      calendar: fakeCalendar,
      gmail:    fakeGmail,
      drive:    fakeDrive,
      docs:     fakeDocs,
      sheets:   fakeSheets,
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

// Import all tool files after mocks are installed
// — Calendar —
const calTodayMod    = await import('../tools/calendar_today.mjs');
const calUpcomingMod = await import('../tools/calendar_upcoming.mjs');
const calSearchMod   = await import('../tools/calendar_search.mjs');
const calCreateMod   = await import('../tools/calendar_create.mjs');
// — Gmail —
const gmailSendMod        = await import('../tools/gmail_send.mjs');
const gmailSearchMod      = await import('../tools/gmail_search.mjs');
const gmailReadMod        = await import('../tools/gmail_read.mjs');
const gmailReplyMod       = await import('../tools/gmail_reply.mjs');
const gmailArchiveMod     = await import('../tools/gmail_archive.mjs');
const gmailTrashMod       = await import('../tools/gmail_trash.mjs');
const gmailMarkReadMod    = await import('../tools/gmail_mark_read.mjs');
const gmailMarkUnreadMod  = await import('../tools/gmail_mark_unread.mjs');
const gmailAddLabelMod    = await import('../tools/gmail_add_label.mjs');
const gmailRemLabelMod    = await import('../tools/gmail_remove_label.mjs');
const gmailCrtLabelMod    = await import('../tools/gmail_create_label.mjs');
const gmailLstLabelsMod   = await import('../tools/gmail_list_labels.mjs');
const gmailLstDraftsMod   = await import('../tools/gmail_list_drafts.mjs');
const gmailCrtDraftMod    = await import('../tools/gmail_create_draft.mjs');
// — Drive —
const driveListFilesMod    = await import('../tools/drive_list_files.mjs');
const driveListFoldersMod  = await import('../tools/drive_list_folders.mjs');
const driveGetInfoMod      = await import('../tools/drive_get_file_info.mjs');
const driveCrtFolderMod    = await import('../tools/drive_create_folder.mjs');
const driveMoveFileMod     = await import('../tools/drive_move_file.mjs');
const driveShareMod        = await import('../tools/drive_share.mjs');
const driveDownloadMod     = await import('../tools/drive_download.mjs');
// — Docs —
const readDocMod     = await import('../tools/read_doc.mjs');
const writeDocMod    = await import('../tools/write_doc.mjs');
const appendDocMod   = await import('../tools/append_to_doc.mjs');
const createDocMod   = await import('../tools/create_doc.mjs');
const listDocsMod    = await import('../tools/list_docs.mjs');
const shareDocMod    = await import('../tools/share_doc.mjs');
// — Sheets —
const readSheetMod         = await import('../tools/read_sheet.mjs');
const writeSheetMod        = await import('../tools/write_sheet.mjs');
const appendSheetMod       = await import('../tools/append_sheet.mjs');
const createSpreadsheetMod = await import('../tools/create_spreadsheet.mjs');
const listSpreadsheetsMod  = await import('../tools/list_spreadsheets.mjs');
const addSheetMod          = await import('../tools/add_sheet.mjs');
const getSheetInfoMod      = await import('../tools/get_sheet_info.mjs');

const calToday    = calTodayMod.default;
const calUpcoming = calUpcomingMod.default;
const calSearch   = calSearchMod.default;
const calCreate   = calCreateMod.default;

const gmailSend       = gmailSendMod.default;
const gmailSearch     = gmailSearchMod.default;
const gmailRead       = gmailReadMod.default;
const gmailReply      = gmailReplyMod.default;
const gmailArchive    = gmailArchiveMod.default;
const gmailTrash      = gmailTrashMod.default;
const gmailMarkRead   = gmailMarkReadMod.default;
const gmailMarkUnread = gmailMarkUnreadMod.default;
const gmailAddLabel   = gmailAddLabelMod.default;
const gmailRemLabel   = gmailRemLabelMod.default;
const gmailCrtLabel   = gmailCrtLabelMod.default;
const gmailLstLabels  = gmailLstLabelsMod.default;
const gmailLstDrafts  = gmailLstDraftsMod.default;
const gmailCrtDraft   = gmailCrtDraftMod.default;

const driveListFiles   = driveListFilesMod.default;
const driveListFolders = driveListFoldersMod.default;
const driveGetInfo     = driveGetInfoMod.default;
const driveCrtFolder   = driveCrtFolderMod.default;
const driveMoveFile    = driveMoveFileMod.default;
const driveShare       = driveShareMod.default;
const driveDownload    = driveDownloadMod.default;

const readDoc     = readDocMod.default;
const writeDoc    = writeDocMod.default;
const appendDoc   = appendDocMod.default;
const createDoc   = createDocMod.default;
const listDocs    = listDocsMod.default;
const shareDoc    = shareDocMod.default;

const readSheet         = readSheetMod.default;
const writeSheet        = writeSheetMod.default;
const appendSheet       = appendSheetMod.default;
const createSpreadsheet = createSpreadsheetMod.default;
const listSpreadsheets  = listSpreadsheetsMod.default;
const addSheet          = addSheetMod.default;
const getSheetInfo      = getSheetInfoMod.default;

// Import pure functions from lib/client.mjs
const { formatEvent, decodeBody, getHeader } = await import('../lib/client.mjs');

const ctx = { credentials: {} };

afterEach(() => {
  mockCalEvents = {};
  mockGmailMessages = {}; mockGmailLabels = {}; mockGmailDrafts = {};
  mockDriveFiles = {}; mockDrivePerms = {};
  mockDocsDocuments = {};
  mockSheetsSpreadsheets = { values: {} };
});

// ===========================================================================
// 1. STRUCTURE TESTS — all 31 tools
// ===========================================================================
describe('zeromcp tool structure', () => {
  const allTools = [
    // Calendar
    { name: 'calendar_today',    mod: calToday },
    { name: 'calendar_upcoming', mod: calUpcoming },
    { name: 'calendar_search',   mod: calSearch },
    { name: 'calendar_create',   mod: calCreate },
    // Gmail
    { name: 'gmail_send',         mod: gmailSend },
    { name: 'gmail_search',       mod: gmailSearch },
    { name: 'gmail_read',         mod: gmailRead },
    { name: 'gmail_reply',        mod: gmailReply },
    { name: 'gmail_archive',      mod: gmailArchive },
    { name: 'gmail_trash',        mod: gmailTrash },
    { name: 'gmail_mark_read',    mod: gmailMarkRead },
    { name: 'gmail_mark_unread',  mod: gmailMarkUnread },
    { name: 'gmail_add_label',    mod: gmailAddLabel },
    { name: 'gmail_remove_label', mod: gmailRemLabel },
    { name: 'gmail_create_label', mod: gmailCrtLabel },
    { name: 'gmail_list_labels',  mod: gmailLstLabels },
    { name: 'gmail_list_drafts',  mod: gmailLstDrafts },
    { name: 'gmail_create_draft', mod: gmailCrtDraft },
    // Drive
    { name: 'drive_list_files',    mod: driveListFiles },
    { name: 'drive_list_folders',  mod: driveListFolders },
    { name: 'drive_get_file_info', mod: driveGetInfo },
    { name: 'drive_create_folder', mod: driveCrtFolder },
    { name: 'drive_move_file',     mod: driveMoveFile },
    { name: 'drive_share',         mod: driveShare },
    { name: 'drive_download',      mod: driveDownload },
    // Docs
    { name: 'read_doc',      mod: readDoc },
    { name: 'write_doc',     mod: writeDoc },
    { name: 'append_to_doc', mod: appendDoc },
    { name: 'create_doc',    mod: createDoc },
    { name: 'list_docs',     mod: listDocs },
    { name: 'share_doc',     mod: shareDoc },
    // Sheets
    { name: 'read_sheet',         mod: readSheet },
    { name: 'write_sheet',        mod: writeSheet },
    { name: 'append_sheet',       mod: appendSheet },
    { name: 'create_spreadsheet', mod: createSpreadsheet },
    { name: 'list_spreadsheets',  mod: listSpreadsheets },
    { name: 'add_sheet',          mod: addSheet },
    { name: 'get_sheet_info',     mod: getSheetInfo },
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

  // Spot-check required fields for key tools
  it('calendar_search: query is required string', () => {
    assert.equal(calSearch.input.query?.type, 'string');
    assert.ok(calSearch.input.query && calSearch.input.query?.optional !== true);
  });

  it('calendar_create: title and start are required', () => {
    assert.ok(calCreate.input.title && calCreate.input.title?.optional !== true);
    assert.ok(calCreate.input.start && calCreate.input.start?.optional !== true);
  });

  it('gmail_send: to, subject, body are required', () => {
    for (const k of ['to', 'subject', 'body']) {
      assert.ok(gmailSend.input[k] && gmailSend.input[k]?.optional !== true);
    }
  });

  it('gmail_reply: messageId and body are required', () => {
    assert.ok(gmailReply.input.messageId && gmailReply.input.messageId?.optional !== true);
    assert.ok(gmailReply.input.body && gmailReply.input.body?.optional !== true);
  });

  it('drive_get_file_info: fileId is required', () => {
    assert.ok(driveGetInfo.input.fileId && driveGetInfo.input.fileId?.optional !== true);
  });

  it('read_doc: documentId is required', () => {
    assert.ok(readDoc.input.documentId && readDoc.input.documentId?.optional !== true);
  });

  it('read_sheet: spreadsheetId and range are required', () => {
    assert.ok(readSheet.input.spreadsheetId && readSheet.input.spreadsheetId?.optional !== true);
    assert.ok(readSheet.input.range && readSheet.input.range?.optional !== true);
  });

  it('write_sheet: values is required array', () => {
    assert.equal(writeSheet.input.values?.type, 'array');
    assert.ok(writeSheet.input.values && writeSheet.input.values?.optional !== true);
  });

  it('create_spreadsheet: title is required, sheets is optional array', () => {
    assert.ok(createSpreadsheet.input.title && createSpreadsheet.input.title?.optional !== true);
    assert.equal(createSpreadsheet.input.sheets?.type, 'array');
    assert.ok(createSpreadsheet.input.sheets?.optional === true);
  });

  it('no tool has a property with an invalid type', () => {
    const validTypes = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']);
    for (const { name, mod } of allTools) {
      for (const [key, prop] of Object.entries(mod.input)) {
        if (prop?.type) {
          assert.ok(validTypes.has(prop.type),
            `${name}.input.${key} has invalid type "${prop.type}"`);
        }
      }
    }
  });
});

// ===========================================================================
// 2. PURE FUNCTION TESTS — formatEvent(), decodeBody(), getHeader()
// ===========================================================================
describe('formatEvent()', () => {
  it('formats a timed event with summary, date, time, and id', () => {
    const event = {
      summary: 'Weekly Sync',
      start: { dateTime: '2026-04-11T10:00:00Z' },
      end:   { dateTime: '2026-04-11T11:00:00Z' },
      id: 'ev1'
    };
    const result = formatEvent(event);
    assert.ok(result.includes('Weekly Sync'));
    assert.ok(result.includes('[id: ev1]'));
    assert.ok(result.includes('📅'));
    assert.ok(result.includes('—'));
  });

  it('shows "(No title)" when summary is missing', () => {
    const event = { start: { dateTime: '2026-04-11T10:00:00Z' }, end: { dateTime: '2026-04-11T11:00:00Z' }, id: 'ev2' };
    assert.ok(formatEvent(event).includes('(No title)'));
  });

  it('shows "All day" for date-only events', () => {
    const event = { summary: 'Holiday', start: { date: '2026-04-11' }, end: { date: '2026-04-12' }, id: 'ev3' };
    const result = formatEvent(event);
    assert.ok(result.includes('All day'));
    assert.ok(result.includes('Holiday'));
  });

  it('includes location when present', () => {
    const event = {
      summary: 'Offsite',
      start: { dateTime: '2026-04-11T09:00:00Z' },
      end:   { dateTime: '2026-04-11T17:00:00Z' },
      location: 'Building 5',
      id: 'ev4'
    };
    assert.ok(formatEvent(event).includes('Building 5'));
  });

  it('includes attendee names (display or email)', () => {
    const event = {
      summary: 'Call',
      start: { dateTime: '2026-04-11T10:00:00Z' },
      end:   { dateTime: '2026-04-11T10:30:00Z' },
      id: 'ev5',
      attendees: [
        { displayName: 'Alice', email: 'alice@test.com' },
        { email: 'bob@test.com' }
      ]
    };
    const result = formatEvent(event);
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('bob@test.com'));
  });

  it('truncates attendees beyond 5 with "+N more"', () => {
    const attendees = Array.from({ length: 7 }, (_, i) => ({ email: `u${i}@t.com` }));
    const event = { summary: 'Crowd', start: { dateTime: '2026-04-11T10:00:00Z' }, end: { dateTime: '2026-04-11T11:00:00Z' }, id: 'ev6', attendees };
    const result = formatEvent(event);
    assert.ok(result.includes('+2 more'));
    assert.ok(!result.includes('u6@t.com'));
  });

  it('exactly 5 attendees — no "+N more"', () => {
    const attendees = Array.from({ length: 5 }, (_, i) => ({ email: `u${i}@t.com` }));
    const event = { summary: 'Five', start: { dateTime: '2026-04-11T10:00:00Z' }, end: { dateTime: '2026-04-11T11:00:00Z' }, id: 'ev7', attendees };
    assert.ok(!formatEvent(event).includes('more'));
  });
});

describe('decodeBody()', () => {
  it('decodes base64url body.data directly', () => {
    const text = 'Hello, world!';
    const data = Buffer.from(text).toString('base64url');
    assert.equal(decodeBody({ body: { data } }), text);
  });

  it('decodes text/plain part from multipart payload', () => {
    const text = 'Plain part';
    const data = Buffer.from(text).toString('base64url');
    const result = decodeBody({
      body: {},
      parts: [
        { mimeType: 'text/plain', body: { data } },
        { mimeType: 'text/html',  body: { data: Buffer.from('<b>html</b>').toString('base64url') } },
      ]
    });
    assert.equal(result, text);
  });

  it('falls back to text/html and strips tags', () => {
    const data = Buffer.from('<p>Hello <b>world</b></p>').toString('base64url');
    const result = decodeBody({ body: {}, parts: [{ mimeType: 'text/html', body: { data } }] });
    assert.equal(result, 'Hello world');
  });

  it('returns empty string when no data available', () => {
    assert.equal(decodeBody({}), '');
    assert.equal(decodeBody({ body: {} }), '');
    assert.equal(decodeBody({ parts: [] }), '');
  });

  it('decodes unicode correctly', () => {
    const text = 'Résumé — Café';
    const data = Buffer.from(text).toString('base64url');
    assert.equal(decodeBody({ body: { data } }), text);
  });
});

describe('getHeader()', () => {
  const headers = [
    { name: 'From',    value: 'alice@test.com' },
    { name: 'Subject', value: 'Test subject' },
    { name: 'Date',    value: 'Mon, 11 Apr 2026' },
  ];

  it('returns value for exact match', () => {
    assert.equal(getHeader(headers, 'Subject'), 'Test subject');
  });

  it('is case-insensitive', () => {
    assert.equal(getHeader(headers, 'subject'), 'Test subject');
    assert.equal(getHeader(headers, 'FROM'), 'alice@test.com');
  });

  it('returns empty string when header not found', () => {
    assert.equal(getHeader(headers, 'To'), '');
    assert.equal(getHeader(headers, 'x-custom'), '');
  });

  it('returns first match when duplicates exist', () => {
    const dupes = [{ name: 'X-Tag', value: 'first' }, { name: 'X-Tag', value: 'second' }];
    assert.equal(getHeader(dupes, 'X-Tag'), 'first');
  });
});

// ===========================================================================
// 3. EXECUTE TESTS — Calendar tools
// ===========================================================================
describe('calendar_today.execute', () => {
  it('returns formatted today events', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ summary: 'Standup', start: { dateTime: '2026-04-11T09:00:00Z' }, end: { dateTime: '2026-04-11T09:15:00Z' }, id: 'e1' }] }
      })
    };
    const result = await calToday.execute({}, ctx);
    assert.ok(result.includes('Standup'));
    assert.ok(result.includes('[id: e1]'));
  });

  it('returns "Nothing on the calendar today." when empty', async () => {
    mockCalEvents = { list: async () => ({ data: { items: [] } }) };
    assert.equal(await calToday.execute({}, ctx), 'Nothing on the calendar today.');
  });

  it('timeMax is exactly 24h after timeMin, both anchored to midnight', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await calToday.execute({}, ctx);
    const min = new Date(captured.timeMin);
    const max = new Date(captured.timeMax);
    assert.equal(max - min, 86400000);
    assert.equal(min.getHours(), 0);
    assert.equal(min.getMinutes(), 0);
  });

  it('propagates API errors', async () => {
    mockCalEvents = { list: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => calToday.execute({}, ctx));
  });
});

describe('calendar_upcoming.execute', () => {
  it('returns formatted upcoming events', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ summary: 'Sprint Review', start: { dateTime: '2026-04-15T14:00:00Z' }, end: { dateTime: '2026-04-15T15:00:00Z' }, id: 'u1' }] }
      })
    };
    const result = await calUpcoming.execute({}, ctx);
    assert.ok(result.includes('Sprint Review'));
    assert.ok(result.includes('[id: u1]'));
  });

  it('returns "No upcoming events." when empty', async () => {
    mockCalEvents = { list: async () => ({ data: { items: [] } }) };
    assert.equal(await calUpcoming.execute({}, ctx), 'No upcoming events.');
  });

  it('defaults to days=7 and limit=20', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await calUpcoming.execute({}, ctx);
    assert.equal(captured.maxResults, 20);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 7);
  });

  it('respects custom days and limit', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await calUpcoming.execute({ days: 30, limit: 50 }, ctx);
    assert.equal(captured.maxResults, 50);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 30);
  });
});

describe('calendar_search.execute', () => {
  it('returns matching events', async () => {
    mockCalEvents = {
      list: async () => ({
        data: { items: [{ summary: 'Design Review', start: { dateTime: '2026-04-20T14:00:00Z' }, end: { dateTime: '2026-04-20T15:00:00Z' }, id: 's1' }] }
      })
    };
    const result = await calSearch.execute({ query: 'Design' }, ctx);
    assert.ok(result.includes('Design Review'));
    assert.ok(result.includes('[id: s1]'));
  });

  it('returns no-match message when empty', async () => {
    mockCalEvents = { list: async () => ({ data: { items: [] } }) };
    assert.equal(await calSearch.execute({ query: 'nope' }, ctx), 'No events matching "nope".');
  });

  it('passes query string to API as q', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await calSearch.execute({ query: 'standup' }, ctx);
    assert.equal(captured.q, 'standup');
  });

  it('defaults to days=30 and limit=10', async () => {
    let captured;
    mockCalEvents = { list: async (args) => { captured = args; return { data: { items: [] } }; } };
    await calSearch.execute({ query: 'x' }, ctx);
    assert.equal(captured.maxResults, 10);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 30);
  });

  it('propagates API errors', async () => {
    mockCalEvents = { list: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => calSearch.execute({ query: 'test' }, ctx));
  });
});

describe('calendar_create.execute', () => {
  it('creates event and returns confirmation string', async () => {
    mockCalEvents = {
      insert: async () => ({
        data: { summary: 'Meeting', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c1' }
      })
    };
    const result = await calCreate.execute({ title: 'Meeting', start: '2026-04-01T10:00:00Z' }, ctx);
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('Meeting'));
  });

  it('defaults end to 1 hour after start', async () => {
    let capturedArgs;
    mockCalEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Q', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c2' } };
      }
    };
    await calCreate.execute({ title: 'Q', start: '2026-04-01T10:00:00Z' }, ctx);
    const diff = new Date(capturedArgs.requestBody.end.dateTime) - new Date(capturedArgs.requestBody.start.dateTime);
    assert.equal(diff, 3600000);
  });

  it('includes location, description, attendees when provided', async () => {
    let capturedArgs;
    mockCalEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'E', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c3' } };
      }
    };
    await calCreate.execute({ title: 'E', start: '2026-04-01T10:00:00Z', location: 'HQ', description: 'Notes', attendees: 'a@b.com, c@d.com' }, ctx);
    assert.equal(capturedArgs.requestBody.location, 'HQ');
    assert.equal(capturedArgs.requestBody.description, 'Notes');
    assert.deepEqual(capturedArgs.requestBody.attendees, [{ email: 'a@b.com' }, { email: 'c@d.com' }]);
  });

  it('propagates API errors', async () => {
    mockCalEvents = { insert: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => calCreate.execute({ title: 'T', start: '2026-04-01T10:00:00Z' }, ctx));
  });
});

// ===========================================================================
// 4. EXECUTE TESTS — Gmail tools
// ===========================================================================
describe('gmail_send.execute', () => {
  it('sends email and returns confirmation', async () => {
    let capturedArgs;
    mockGmailMessages = { send: async (args) => { capturedArgs = args; return { data: { id: 'sent1' } }; } };
    const result = await gmailSend.execute({ to: 'bob@test.com', subject: 'Hi', body: 'Hello' }, ctx);
    assert.ok(result.includes('Sent to bob@test.com'));
    assert.ok(result.includes('[id: sent1]'));
    assert.equal(capturedArgs.userId, 'me');
  });

  it('raw message contains correct headers', async () => {
    let capturedArgs;
    mockGmailMessages = { send: async (args) => { capturedArgs = args; return { data: { id: 's2' } }; } };
    await gmailSend.execute({ to: 'x@y.com', subject: 'Test', body: 'Body' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('To: x@y.com'));
    assert.ok(raw.includes('Subject: Test'));
    assert.ok(raw.includes('Body'));
  });

  it('includes Cc and Bcc when provided', async () => {
    let capturedArgs;
    mockGmailMessages = { send: async (args) => { capturedArgs = args; return { data: { id: 's3' } }; } };
    await gmailSend.execute({ to: 'x@y.com', subject: 'Hi', body: 'B', cc: 'cc@t.com', bcc: 'bcc@t.com' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('Cc: cc@t.com'));
    assert.ok(raw.includes('Bcc: bcc@t.com'));
  });

  it('propagates API errors', async () => {
    mockGmailMessages = { send: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => gmailSend.execute({ to: 'x@y.com', subject: 'Hi', body: 'B' }, ctx));
  });
});

describe('gmail_search.execute', () => {
  it('returns formatted message list', async () => {
    mockGmailMessages = {
      list: async () => ({ data: { messages: [{ id: 'm1' }] } }),
      get: async () => ({
        data: { payload: { headers: [
          { name: 'From',    value: 'alice@test.com' },
          { name: 'Subject', value: 'Invoice' },
          { name: 'Date',    value: '2026-04-11' },
        ] } }
      }),
    };
    const result = await gmailSearch.execute({ query: 'invoice' }, ctx);
    assert.ok(result.includes('Invoice'));
    assert.ok(result.includes('alice@test.com'));
    assert.ok(result.includes('[id: m1]'));
  });

  it('returns "No messages found." when empty', async () => {
    mockGmailMessages = { list: async () => ({ data: {} }) };
    assert.equal(await gmailSearch.execute({ query: 'x' }, ctx), 'No messages found.');
  });

  it('defaults limit to 10', async () => {
    let captured;
    mockGmailMessages = { list: async (args) => { captured = args; return { data: {} }; } };
    await gmailSearch.execute({ query: 'test' }, ctx);
    assert.equal(captured.maxResults, 10);
  });

  it('propagates API errors', async () => {
    mockGmailMessages = { list: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => gmailSearch.execute({ query: 'test' }, ctx));
  });
});

describe('gmail_read.execute', () => {
  it('returns formatted message with headers and decoded body', async () => {
    const bodyData = Buffer.from('Hello there').toString('base64url');
    mockGmailMessages = {
      get: async () => ({
        data: {
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From',    value: 'sender@test.com' },
              { name: 'To',      value: 'me@test.com' },
              { name: 'Date',    value: '2026-04-11' },
            ],
            body: { data: bodyData }
          }
        }
      })
    };
    const result = await gmailRead.execute({ messageId: 'm1' }, ctx);
    assert.ok(result.includes('Subject: Test Subject'));
    assert.ok(result.includes('From: sender@test.com'));
    assert.ok(result.includes('Hello there'));
  });

  it('propagates API errors', async () => {
    mockGmailMessages = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => gmailRead.execute({ messageId: 'bad' }, ctx));
  });
});

describe('gmail_reply.execute', () => {
  it('replies and sets threadId, In-Reply-To headers', async () => {
    let sendArgs;
    mockGmailMessages = {
      get: async () => ({
        data: {
          threadId: 'thread1',
          payload: { headers: [
            { name: 'From',       value: 'alice@test.com' },
            { name: 'Subject',    value: 'Original' },
            { name: 'Message-ID', value: '<id@mail>' },
          ] }
        }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'reply1' } }; }
    };
    const result = await gmailReply.execute({ messageId: 'orig', body: 'Thanks!' }, ctx);
    assert.ok(result.includes('Replied to alice@test.com'));
    assert.equal(sendArgs.requestBody.threadId, 'thread1');
    const raw = Buffer.from(sendArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('In-Reply-To: <id@mail>'));
    assert.ok(raw.includes('Re: Original'));
  });

  it('does not double-prefix "Re: Re:"', async () => {
    let sendArgs;
    mockGmailMessages = {
      get: async () => ({
        data: { threadId: 't1', payload: { headers: [
          { name: 'From',       value: 'a@b.com' },
          { name: 'Subject',    value: 'Re: Already' },
          { name: 'Message-ID', value: '<id>' },
        ] } }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'r1' } }; }
    };
    await gmailReply.execute({ messageId: 'orig', body: 'OK' }, ctx);
    const raw = Buffer.from(sendArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(!raw.includes('Re: Re:'));
  });
});

describe('gmail_archive.execute', () => {
  it('removes INBOX label and returns confirmation', async () => {
    let capturedArgs;
    mockGmailMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await gmailArchive.execute({ messageId: 'm1' }, ctx);
    assert.ok(result.includes('Archived'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['INBOX']);
  });
});

describe('gmail_trash.execute', () => {
  it('trashes message and returns confirmation', async () => {
    let capturedArgs;
    mockGmailMessages = { trash: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await gmailTrash.execute({ messageId: 'm2' }, ctx);
    assert.ok(result.includes('Trashed'));
    assert.equal(capturedArgs.id, 'm2');
  });
});

describe('gmail_mark_read.execute', () => {
  it('removes UNREAD label', async () => {
    let capturedArgs;
    mockGmailMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await gmailMarkRead.execute({ messageId: 'm3' }, ctx);
    assert.ok(result.includes('Marked as read'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['UNREAD']);
  });
});

describe('gmail_mark_unread.execute', () => {
  it('adds UNREAD label', async () => {
    let capturedArgs;
    mockGmailMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await gmailMarkUnread.execute({ messageId: 'm4' }, ctx);
    assert.ok(result.includes('Marked as unread'));
    assert.deepEqual(capturedArgs.requestBody.addLabelIds, ['UNREAD']);
  });
});

describe('gmail_add_label.execute', () => {
  it('adds label to message', async () => {
    let capturedArgs;
    mockGmailMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await gmailAddLabel.execute({ messageId: 'm5', labelId: 'L1' }, ctx);
    assert.ok(result.includes('Label added'));
    assert.deepEqual(capturedArgs.requestBody.addLabelIds, ['L1']);
  });
});

describe('gmail_remove_label.execute', () => {
  it('removes label from message', async () => {
    let capturedArgs;
    mockGmailMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await gmailRemLabel.execute({ messageId: 'm6', labelId: 'L2' }, ctx);
    assert.ok(result.includes('Label removed'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['L2']);
  });
});

describe('gmail_create_label.execute', () => {
  it('creates label and returns confirmation with id', async () => {
    let capturedArgs;
    mockGmailLabels = { create: async (args) => { capturedArgs = args; return { data: { id: 'Label_99' } }; } };
    const result = await gmailCrtLabel.execute({ name: 'Urgent' }, ctx);
    assert.ok(result.includes('Label created'));
    assert.ok(result.includes('Urgent'));
    assert.ok(result.includes('[id: Label_99]'));
    assert.equal(capturedArgs.requestBody.name, 'Urgent');
  });
});

describe('gmail_list_labels.execute', () => {
  it('returns formatted label list', async () => {
    mockGmailLabels = {
      list: async () => ({ data: { labels: [{ name: 'Work', id: 'L1' }, { name: 'Personal', id: 'L2' }] } })
    };
    const result = await gmailLstLabels.execute({}, ctx);
    assert.ok(result.includes('Work'));
    assert.ok(result.includes('[id: L1]'));
    assert.ok(result.includes('Personal'));
  });

  it('returns "No labels found." when empty', async () => {
    mockGmailLabels = { list: async () => ({ data: { labels: [] } }) };
    assert.equal(await gmailLstLabels.execute({}, ctx), 'No labels found.');
  });
});

describe('gmail_list_drafts.execute', () => {
  it('returns formatted drafts', async () => {
    mockGmailDrafts = {
      list: async () => ({ data: { drafts: [{ id: 'd1' }] } }),
      get: async () => ({
        data: { message: { payload: { headers: [
          { name: 'Subject', value: 'Draft Subject' },
          { name: 'To',      value: 'bob@test.com' },
        ] } } }
      })
    };
    const result = await gmailLstDrafts.execute({}, ctx);
    assert.ok(result.includes('Draft Subject'));
    assert.ok(result.includes('bob@test.com'));
    assert.ok(result.includes('[id: d1]'));
  });

  it('returns "No drafts found." when empty', async () => {
    mockGmailDrafts = { list: async () => ({ data: {} }) };
    assert.equal(await gmailLstDrafts.execute({}, ctx), 'No drafts found.');
  });
});

describe('gmail_create_draft.execute', () => {
  it('creates draft and returns confirmation', async () => {
    let capturedArgs;
    mockGmailDrafts = { create: async (args) => { capturedArgs = args; return { data: { id: 'd3' } }; } };
    const result = await gmailCrtDraft.execute({ to: 'bob@test.com', subject: 'My Draft', body: 'Content' }, ctx);
    assert.ok(result.includes('Draft created'));
    assert.ok(result.includes('[id: d3]'));
    assert.equal(capturedArgs.userId, 'me');
    const raw = Buffer.from(capturedArgs.requestBody.message.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('To: bob@test.com'));
    assert.ok(raw.includes('Subject: My Draft'));
  });
});

// ===========================================================================
// 5. EXECUTE TESTS — Drive tools
// ===========================================================================
describe('drive_list_files.execute', () => {
  it('returns formatted file list', async () => {
    mockDriveFiles = {
      list: async () => ({
        data: { files: [
          { id: 'f1', name: 'Report.pdf',  mimeType: 'application/pdf' },
          { id: 'f2', name: 'Notes',       mimeType: 'application/vnd.google-apps.document' },
        ] }
      })
    };
    const result = await driveListFiles.execute({}, ctx);
    assert.ok(result.includes('Report.pdf'));
    assert.ok(result.includes('[id: f1]'));
    assert.ok(result.includes('Notes'));
  });

  it('passes filters to API', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await driveListFiles.execute({ query: 'report', folderId: 'f1', mimeType: 'application/pdf', limit: 5 }, ctx);
    assert.ok(captured.q.includes("name contains 'report'"));
    assert.ok(captured.q.includes("'f1' in parents"));
    assert.ok(captured.q.includes("mimeType = 'application/pdf'"));
    assert.equal(captured.pageSize, 5);
  });

  it('no q when no filters', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await driveListFiles.execute({}, ctx);
    assert.equal(captured.q, undefined);
  });
});

describe('drive_list_folders.execute', () => {
  it('returns formatted folder list', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 'fo1', name: 'Projects' }] } })
    };
    const result = await driveListFolders.execute({}, ctx);
    assert.ok(result.includes('Projects'));
    assert.ok(result.includes('[id: fo1]'));
  });

  it('always includes folder mimeType in query', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await driveListFolders.execute({}, ctx);
    assert.ok(captured.q.includes("mimeType = 'application/vnd.google-apps.folder'"));
  });
});

describe('drive_get_file_info.execute', () => {
  it('returns file metadata object', async () => {
    mockDriveFiles = {
      get: async () => ({ data: { id: 'f1', name: 'MyFile', mimeType: 'application/pdf' } })
    };
    const result = await driveGetInfo.execute({ fileId: 'f1' }, ctx);
    assert.equal(result.id, 'f1');
    assert.equal(result.name, 'MyFile');
  });

  it('propagates API errors', async () => {
    mockDriveFiles = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => driveGetInfo.execute({ fileId: 'bad' }, ctx));
  });
});

describe('drive_create_folder.execute', () => {
  it('creates folder and returns data', async () => {
    let capturedArgs;
    mockDriveFiles = { create: async (args) => { capturedArgs = args; return { data: { id: 'fo2', name: 'New' } }; } };
    const result = await driveCrtFolder.execute({ name: 'New' }, ctx);
    assert.equal(result.id, 'fo2');
    assert.equal(capturedArgs.requestBody.mimeType, 'application/vnd.google-apps.folder');
  });

  it('includes parents when parentId provided', async () => {
    let capturedArgs;
    mockDriveFiles = { create: async (args) => { capturedArgs = args; return { data: { id: 'fo3' } }; } };
    await driveCrtFolder.execute({ name: 'Sub', parentId: 'parent1' }, ctx);
    assert.deepEqual(capturedArgs.requestBody.parents, ['parent1']);
  });
});

describe('drive_move_file.execute', () => {
  it('moves file to new folder', async () => {
    let updateArgs;
    mockDriveFiles = {
      get: async () => ({ data: { parents: ['old'], name: 'File' } }),
      update: async (args) => { updateArgs = args; return { data: { id: 'f1', name: 'File' } }; }
    };
    const result = await driveMoveFile.execute({ fileId: 'f1', folderId: 'new' }, ctx);
    assert.equal(updateArgs.addParents, 'new');
    assert.equal(updateArgs.removeParents, 'old');
    assert.equal(result.id, 'f1');
  });
});

describe('drive_share.execute', () => {
  it('shares and returns confirmation', async () => {
    let permArgs;
    mockDrivePerms = { create: async (args) => { permArgs = args; return { data: {} }; } };
    mockDriveFiles = { get: async () => ({ data: { name: 'F', webViewLink: 'https://x' } }) };
    const result = await driveShare.execute({ fileId: 'f1', email: 'bob@test.com', role: 'writer' }, ctx);
    assert.equal(result.shared, 'bob@test.com');
    assert.equal(result.role, 'writer');
    assert.equal(permArgs.requestBody.emailAddress, 'bob@test.com');
  });

  it('defaults role to reader', async () => {
    let permArgs;
    mockDrivePerms = { create: async (args) => { permArgs = args; return { data: {} }; } };
    mockDriveFiles = { get: async () => ({ data: { name: 'F', webViewLink: 'https://x' } }) };
    const result = await driveShare.execute({ fileId: 'f1', email: 'x@y.com' }, ctx);
    assert.equal(result.role, 'reader');
  });
});

// ===========================================================================
// 6. EXECUTE TESTS — Docs tools
// ===========================================================================
describe('create_doc.execute', () => {
  it('creates doc and returns id and url', async () => {
    mockDocsDocuments = { create: async () => ({ data: { documentId: 'doc1' } }) };
    const result = await createDoc.execute({ title: 'My Doc' }, ctx);
    assert.equal(result.id, 'doc1');
    assert.ok(result.url.includes('doc1'));
  });

  it('inserts content via batchUpdate when provided', async () => {
    let batchArgs;
    mockDocsDocuments = {
      create: async () => ({ data: { documentId: 'doc2' } }),
      batchUpdate: async (args) => { batchArgs = args; return { data: {} }; },
    };
    await createDoc.execute({ title: 'Doc', content: 'Hello world' }, ctx);
    assert.equal(batchArgs.requestBody.requests[0].insertText.text, 'Hello world');
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

  it('propagates API errors', async () => {
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
              { paragraph: { elements: [{ textRun: { content: 'Hello ' } }, { textRun: { content: 'world' } }] } }
            ]
          }
        }
      })
    };
    const result = await readDoc.execute({ documentId: 'doc1' }, ctx);
    assert.equal(result.title, 'Test Doc');
    assert.equal(result.text, 'Hello world');
  });

  it('propagates API errors', async () => {
    mockDocsDocuments = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => readDoc.execute({ documentId: 'bad' }, ctx));
  });
});

describe('append_to_doc.execute', () => {
  it('appends text and returns char count', async () => {
    let batchArgs;
    mockDocsDocuments = {
      get: async () => ({ data: { body: { content: [{ endIndex: 50 }] } } }),
      batchUpdate: async (args) => { batchArgs = args; return { data: {} }; },
    };
    const result = await appendDoc.execute({ documentId: 'doc1', text: 'Appended' }, ctx);
    assert.equal(batchArgs.requestBody.requests[0].insertText.location.index, 49);
    assert.equal(batchArgs.requestBody.requests[0].insertText.text, 'Appended');
    assert.equal(result.documentId, 'doc1');
    assert.ok(result.appended.includes('8'));
  });
});

describe('list_docs.execute', () => {
  it('returns array of doc objects', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 'd1', name: 'Doc 1' }] } })
    };
    const result = await listDocs.execute({}, ctx);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Doc 1');
  });

  it('always includes mimeType filter for docs', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listDocs.execute({}, ctx);
    assert.ok(captured.q.includes("mimeType='application/vnd.google-apps.document'"));
  });
});

describe('share_doc.execute', () => {
  it('shares doc and returns url', async () => {
    let permArgs;
    mockDrivePerms = { create: async (args) => { permArgs = args; return { data: {} }; } };
    const result = await shareDoc.execute({ documentId: 'doc1', email: 'bob@test.com' }, ctx);
    assert.equal(result.shared, 'bob@test.com');
    assert.ok(result.url.includes('doc1'));
    assert.equal(permArgs.fileId, 'doc1');
  });

  it('defaults role to writer', async () => {
    let permArgs;
    mockDrivePerms = { create: async (args) => { permArgs = args; return { data: {} }; } };
    const result = await shareDoc.execute({ documentId: 'doc1', email: 'x@y.com' }, ctx);
    assert.equal(result.role, 'writer');
  });
});

// ===========================================================================
// 7. EXECUTE TESTS — Sheets tools
// ===========================================================================
describe('read_sheet.execute', () => {
  it('returns sheet values as 2D array', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: { values: [['A', 'B'], ['1', '2']] } }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    const result = await readSheet.execute({ spreadsheetId: 's1', range: 'Sheet1!A1:B2' }, ctx);
    assert.deepEqual(result, [['A', 'B'], ['1', '2']]);
  });

  it('returns empty array when no values', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({ data: {} }), update: async () => ({}), append: async () => ({}) },
      get: async () => ({})
    };
    assert.deepEqual(await readSheet.execute({ spreadsheetId: 's1', range: 'A1' }, ctx), []);
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
  it('writes data and returns updatedCells', async () => {
    let captured;
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async (args) => { captured = args; return { data: { updatedCells: 4 } }; },
        append: async () => ({})
      },
      get: async () => ({})
    };
    const result = await writeSheet.execute({ spreadsheetId: 's1', range: 'A1', values: [['a', 'b'], ['c', 'd']] }, ctx);
    assert.equal(result.updatedCells, 4);
    assert.equal(captured.valueInputOption, 'USER_ENTERED');
  });
});

describe('append_sheet.execute', () => {
  it('appends rows and returns updatedRows', async () => {
    mockSheetsSpreadsheets = {
      values: {
        get: async () => ({}),
        update: async () => ({}),
        append: async () => ({ data: { updates: { updatedRows: 2 } } })
      },
      get: async () => ({})
    };
    const result = await appendSheet.execute({ spreadsheetId: 's1', range: 'Sheet1', values: [['x'], ['y']] }, ctx);
    assert.equal(result.updatedRows, 2);
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
          properties: { title: 'Budget' },
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp1',
          sheets: [{ properties: { title: 'Sheet1' } }]
        }
      }),
      batchUpdate: async () => ({})
    };
    const result = await createSpreadsheet.execute({ title: 'Budget' }, ctx);
    assert.equal(result.spreadsheetId, 'sp1');
    assert.equal(result.title, 'Budget');
    assert.deepEqual(result.sheets, ['Sheet1']);
  });

  it('passes custom sheet names', async () => {
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
    assert.deepEqual(result.sheets, ['Revenue', 'Costs']);
  });
});

describe('list_spreadsheets.execute', () => {
  it('returns array of spreadsheet objects', async () => {
    mockDriveFiles = {
      list: async () => ({ data: { files: [{ id: 's1', name: 'Budget' }] } })
    };
    const result = await listSpreadsheets.execute({}, ctx);
    assert.equal(result[0].name, 'Budget');
  });

  it('defaults to limit=20', async () => {
    let captured;
    mockDriveFiles = { list: async (args) => { captured = args; return { data: { files: [] } }; } };
    await listSpreadsheets.execute({}, ctx);
    assert.equal(captured.pageSize, 20);
  });
});

describe('add_sheet.execute', () => {
  it('adds sheet and returns properties', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({}),
      create: async () => ({}),
      batchUpdate: async () => ({
        data: { replies: [{ addSheet: { properties: { sheetId: 42, title: 'Q2', index: 1 } } }] }
      })
    };
    const result = await addSheet.execute({ spreadsheetId: 'sp1', title: 'Q2' }, ctx);
    assert.equal(result.sheetId, 42);
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
        return { data: { replies: [{ addSheet: { properties: { sheetId: 1, title: 'T', index: 0 } } }] } };
      }
    };
    await addSheet.execute({ spreadsheetId: 'sp1', title: 'T' }, ctx);
    assert.equal(captured.spreadsheetId, 'sp1');
    assert.deepEqual(captured.resource.requests, [{ addSheet: { properties: { title: 'T' } } }]);
  });
});

describe('get_sheet_info.execute', () => {
  it('returns title and sheet metadata', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => ({
        data: {
          properties: { title: 'My Sheet' },
          sheets: [
            { properties: { title: 'Sheet1', index: 0, gridProperties: { rowCount: 1000, columnCount: 26 } } }
          ]
        }
      })
    };
    const result = await getSheetInfo.execute({ spreadsheetId: 'sp1' }, ctx);
    assert.equal(result.title, 'My Sheet');
    assert.equal(result.sheets[0].rowCount, 1000);
    assert.equal(result.sheets[0].columnCount, 26);
  });

  it('propagates API errors', async () => {
    mockSheetsSpreadsheets = {
      values: { get: async () => ({}), update: async () => ({}), append: async () => ({}) },
      get: async () => { throw new Error('API 404'); }
    };
    await assert.rejects(() => getSheetInfo.execute({ spreadsheetId: 'bad' }, ctx));
  });
});
