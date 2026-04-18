/**
 * Comprehensive unit tests for mcp-gmail zeromcp tool files.
 *
 * Tests three layers:
 *   1. Structure — each tools/*.mjs exports valid { description, input, execute }
 *   2. Pure functions — decodeBody() and getHeader() in lib/client.mjs
 *   3. Execute behaviour — tools wired to a mocked googleapis gmail client
 */

import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis and auth-google BEFORE any tool files are imported
// ---------------------------------------------------------------------------
let mockMessages = {};
let mockLabels   = {};
let mockDrafts   = {};

const fakeGmail = () => ({
  users: {
    messages: {
      list:   (...a) => mockMessages.list(...a),
      get:    (...a) => mockMessages.get(...a),
      send:   (...a) => mockMessages.send(...a),
      modify: (...a) => mockMessages.modify(...a),
      trash:  (...a) => mockMessages.trash(...a),
    },
    labels: {
      list:   (...a) => mockLabels.list(...a),
      create: (...a) => mockLabels.create(...a),
    },
    drafts: {
      list:   (...a) => mockDrafts.list(...a),
      get:    (...a) => mockDrafts.get(...a),
      create: (...a) => mockDrafts.create(...a),
    },
  }
});

await mock.module('googleapis', {
  namedExports: {
    google: {
      gmail: fakeGmail,
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
const sendMod        = await import('../tools/send.mjs');
const searchMod      = await import('../tools/search.mjs');
const readMod        = await import('../tools/read.mjs');
const replyMod       = await import('../tools/reply.mjs');
const archiveMod     = await import('../tools/archive.mjs');
const trashMod       = await import('../tools/trash.mjs');
const markReadMod    = await import('../tools/mark_read.mjs');
const markUnreadMod  = await import('../tools/mark_unread.mjs');
const addLabelMod    = await import('../tools/add_label.mjs');
const removeLabelMod = await import('../tools/remove_label.mjs');
const createLabelMod = await import('../tools/create_label.mjs');
const listLabelsMod  = await import('../tools/list_labels.mjs');
const listDraftsMod  = await import('../tools/list_drafts.mjs');
const createDraftMod = await import('../tools/create_draft.mjs');

const send        = sendMod.default;
const search      = searchMod.default;
const read        = readMod.default;
const reply       = replyMod.default;
const archive     = archiveMod.default;
const trash       = trashMod.default;
const markRead    = markReadMod.default;
const markUnread  = markUnreadMod.default;
const addLabel    = addLabelMod.default;
const removeLabel = removeLabelMod.default;
const createLabel = createLabelMod.default;
const listLabels  = listLabelsMod.default;
const listDrafts  = listDraftsMod.default;
const createDraft = createDraftMod.default;

// Import pure functions
const { decodeBody, getHeader } = await import('../lib/client.mjs');

const ctx = { credentials: {} };

afterEach(() => { mockMessages = {}; mockLabels = {}; mockDrafts = {}; });

// ===========================================================================
// 1. STRUCTURE TESTS
// ===========================================================================
describe('zeromcp tool structure', () => {
  const tools = [
    { name: 'send',         mod: send },
    { name: 'search',       mod: search },
    { name: 'read',         mod: read },
    { name: 'reply',        mod: reply },
    { name: 'archive',      mod: archive },
    { name: 'trash',        mod: trash },
    { name: 'mark_read',    mod: markRead },
    { name: 'mark_unread',  mod: markUnread },
    { name: 'add_label',    mod: addLabel },
    { name: 'remove_label', mod: removeLabel },
    { name: 'create_label', mod: createLabel },
    { name: 'list_labels',  mod: listLabels },
    { name: 'list_drafts',  mod: listDrafts },
    { name: 'create_draft', mod: createDraft },
  ];

  for (const { name, mod } of tools) {
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
  it('send: to, subject, body are required strings', () => {
    for (const key of ['to', 'subject', 'body']) {
      assert.equal(send.input[key]?.type, 'string');
      assert.ok(send.input[key] && send.input[key]?.optional !== true);
    }
  });

  it('send: cc and bcc are optional strings', () => {
    for (const key of ['cc', 'bcc']) {
      assert.equal(send.input[key]?.type, 'string');
      assert.ok(send.input[key]?.optional === true);
    }
  });

  it('search: query is required string, limit is optional number', () => {
    assert.equal(search.input.query?.type, 'string');
    assert.ok(search.input.query && search.input.query?.optional !== true);
    assert.equal(search.input.limit?.type, 'number');
    assert.ok(search.input.limit?.optional === true);
  });

  it('read: messageId is required string', () => {
    assert.equal(read.input.messageId?.type, 'string');
    assert.ok(read.input.messageId && read.input.messageId?.optional !== true);
  });

  it('reply: messageId and body are required strings', () => {
    assert.equal(reply.input.messageId?.type, 'string');
    assert.ok(reply.input.messageId && reply.input.messageId?.optional !== true);
    assert.equal(reply.input.body?.type, 'string');
    assert.ok(reply.input.body && reply.input.body?.optional !== true);
  });

  it('archive/trash/mark_read/mark_unread: messageId is required string', () => {
    for (const mod of [archive, trash, markRead, markUnread]) {
      assert.equal(mod.input.messageId?.type, 'string');
      assert.ok(mod.input.messageId && mod.input.messageId?.optional !== true);
    }
  });

  it('add_label/remove_label: messageId and labelId are required strings', () => {
    for (const mod of [addLabel, removeLabel]) {
      assert.equal(mod.input.messageId?.type, 'string');
      assert.ok(mod.input.messageId && mod.input.messageId?.optional !== true);
      assert.equal(mod.input.labelId?.type, 'string');
      assert.ok(mod.input.labelId && mod.input.labelId?.optional !== true);
    }
  });

  it('create_label: name is required string', () => {
    assert.equal(createLabel.input.name?.type, 'string');
    assert.ok(createLabel.input.name && createLabel.input.name?.optional !== true);
  });

  it('list_labels: input has no required fields', () => {
    const required = Object.values(listLabels.input).filter(v => v?.required);
    assert.equal(required.length, 0);
  });

  it('list_drafts: limit is optional number', () => {
    assert.equal(listDrafts.input.limit?.type, 'number');
    assert.ok(listDrafts.input.limit?.optional === true);
  });

  it('create_draft: to, subject, body are required; cc is optional', () => {
    for (const key of ['to', 'subject', 'body']) {
      assert.equal(createDraft.input[key]?.type, 'string');
      assert.ok(createDraft.input[key] && createDraft.input[key]?.optional !== true);
    }
    assert.equal(createDraft.input.cc?.type, 'string');
    assert.ok(createDraft.input.cc?.optional === true);
  });
});

// ===========================================================================
// 2. PURE FUNCTION TESTS — decodeBody() and getHeader()
// ===========================================================================
describe('decodeBody()', () => {
  it('decodes base64url body.data directly', () => {
    const text = 'Hello, world!';
    const data = Buffer.from(text).toString('base64url');
    const result = decodeBody({ body: { data } });
    assert.equal(result, text);
  });

  it('decodes text/plain part from multipart payload', () => {
    const text = 'Plain text part';
    const data = Buffer.from(text).toString('base64url');
    const result = decodeBody({
      body: {},
      parts: [
        { mimeType: 'text/plain', body: { data } },
        { mimeType: 'text/html', body: { data: Buffer.from('<b>html</b>').toString('base64url') } },
      ]
    });
    assert.equal(result, text);
  });

  it('falls back to text/html part and strips tags', () => {
    const data = Buffer.from('<p>Hello <b>world</b></p>').toString('base64url');
    const result = decodeBody({
      body: {},
      parts: [
        { mimeType: 'text/html', body: { data } },
      ]
    });
    assert.equal(result, 'Hello world');
  });

  it('returns empty string when no body data or parts', () => {
    assert.equal(decodeBody({}), '');
    assert.equal(decodeBody({ body: {} }), '');
    assert.equal(decodeBody({ parts: [] }), '');
  });

  it('returns empty string when parts have no data', () => {
    const result = decodeBody({
      parts: [
        { mimeType: 'text/plain', body: {} },
      ]
    });
    assert.equal(result, '');
  });

  it('decodes unicode content correctly', () => {
    const text = 'Café — résumé';
    const data = Buffer.from(text).toString('base64url');
    const result = decodeBody({ body: { data } });
    assert.equal(result, text);
  });
});

describe('getHeader()', () => {
  const headers = [
    { name: 'From',    value: 'alice@test.com' },
    { name: 'Subject', value: 'Hello there' },
    { name: 'Date',    value: 'Mon, 11 Apr 2026' },
  ];

  it('returns the value for an exact match', () => {
    assert.equal(getHeader(headers, 'Subject'), 'Hello there');
  });

  it('is case-insensitive', () => {
    assert.equal(getHeader(headers, 'subject'), 'Hello there');
    assert.equal(getHeader(headers, 'FROM'), 'alice@test.com');
    assert.equal(getHeader(headers, 'fRoM'), 'alice@test.com');
  });

  it('returns empty string when header not found', () => {
    assert.equal(getHeader(headers, 'To'), '');
    assert.equal(getHeader(headers, 'X-Custom'), '');
  });

  it('returns first match when duplicates exist', () => {
    const dupeHeaders = [
      { name: 'X-Tag', value: 'first' },
      { name: 'X-Tag', value: 'second' },
    ];
    assert.equal(getHeader(dupeHeaders, 'X-Tag'), 'first');
  });
});

// ===========================================================================
// 3. EXECUTE TESTS — send
// ===========================================================================
describe('send.execute', () => {
  it('sends email and returns confirmation with id', async () => {
    let capturedArgs;
    mockMessages = {
      send: async (args) => { capturedArgs = args; return { data: { id: 'sent1' } }; }
    };
    const result = await send.execute({ to: 'bob@test.com', subject: 'Hi', body: 'Hello' }, ctx);
    assert.ok(result.includes('Sent to bob@test.com'));
    assert.ok(result.includes('[id: sent1]'));
    assert.equal(capturedArgs.userId, 'me');
    assert.ok(capturedArgs.requestBody.raw);
  });

  it('raw message contains correct headers', async () => {
    let capturedArgs;
    mockMessages = { send: async (args) => { capturedArgs = args; return { data: { id: 's2' } }; } };
    await send.execute({ to: 'x@y.com', subject: 'Test', body: 'Body text' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('To: x@y.com'));
    assert.ok(raw.includes('Subject: Test'));
    assert.ok(raw.includes('Content-Type: text/plain; charset=utf-8'));
    assert.ok(raw.includes('Body text'));
  });

  it('includes Cc and Bcc headers when provided', async () => {
    let capturedArgs;
    mockMessages = { send: async (args) => { capturedArgs = args; return { data: { id: 's3' } }; } };
    await send.execute({ to: 'x@y.com', subject: 'Hi', body: 'B', cc: 'cc@test.com', bcc: 'bcc@test.com' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('Cc: cc@test.com'));
    assert.ok(raw.includes('Bcc: bcc@test.com'));
  });

  it('omits Cc and Bcc headers when not provided', async () => {
    let capturedArgs;
    mockMessages = { send: async (args) => { capturedArgs = args; return { data: { id: 's4' } }; } };
    await send.execute({ to: 'x@y.com', subject: 'Hi', body: 'B' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(!raw.includes('Cc:'));
    assert.ok(!raw.includes('Bcc:'));
  });

  it('propagates API errors', async () => {
    mockMessages = { send: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => send.execute({ to: 'x@y.com', subject: 'Hi', body: 'B' }, ctx));
  });
});

// ===========================================================================
// 4. EXECUTE TESTS — search
// ===========================================================================
describe('search.execute', () => {
  it('returns formatted message list', async () => {
    mockMessages = {
      list: async () => ({ data: { messages: [{ id: 'm1' }, { id: 'm2' }] } }),
      get: async (args) => ({
        data: {
          payload: {
            headers: [
              { name: 'From',    value: args.id === 'm1' ? 'alice@test.com' : 'bob@test.com' },
              { name: 'Subject', value: args.id === 'm1' ? 'Invoice' : 'Receipt' },
              { name: 'Date',    value: '2026-04-11' },
            ]
          }
        }
      }),
    };
    const result = await search.execute({ query: 'invoice' }, ctx);
    assert.ok(result.includes('Invoice'));
    assert.ok(result.includes('alice@test.com'));
    assert.ok(result.includes('[id: m1]'));
    assert.ok(result.includes('Receipt'));
    assert.ok(result.includes('bob@test.com'));
  });

  it('returns "No messages found." when no results', async () => {
    mockMessages = { list: async () => ({ data: {} }) };
    const result = await search.execute({ query: 'nothing' }, ctx);
    assert.equal(result, 'No messages found.');
  });

  it('returns "No messages found." when messages is empty array', async () => {
    mockMessages = { list: async () => ({ data: { messages: [] } }) };
    const result = await search.execute({ query: 'nothing' }, ctx);
    assert.equal(result, 'No messages found.');
  });

  it('passes query and limit to API', async () => {
    let captured;
    mockMessages = { list: async (args) => { captured = args; return { data: {} }; } };
    await search.execute({ query: 'from:bob', limit: 5 }, ctx);
    assert.equal(captured.q, 'from:bob');
    assert.equal(captured.maxResults, 5);
    assert.equal(captured.userId, 'me');
  });

  it('defaults limit to 10', async () => {
    let captured;
    mockMessages = { list: async (args) => { captured = args; return { data: {} }; } };
    await search.execute({ query: 'test' }, ctx);
    assert.equal(captured.maxResults, 10);
  });

  it('uses metadata format for list items', async () => {
    let capturedGet;
    mockMessages = {
      list: async () => ({ data: { messages: [{ id: 'x1' }] } }),
      get: async (args) => {
        capturedGet = args;
        return { data: { payload: { headers: [{ name: 'Subject', value: 'S' }, { name: 'From', value: 'f@f.com' }, { name: 'Date', value: 'D' }] } } };
      },
    };
    await search.execute({ query: 'test' }, ctx);
    assert.equal(capturedGet.format, 'metadata');
    assert.deepEqual(capturedGet.metadataHeaders, ['From', 'Subject', 'Date']);
  });

  it('propagates API errors', async () => {
    mockMessages = { list: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => search.execute({ query: 'test' }, ctx));
  });
});

// ===========================================================================
// 5. EXECUTE TESTS — read
// ===========================================================================
describe('read.execute', () => {
  it('returns formatted message with headers and body', async () => {
    const bodyText = Buffer.from('Hello there').toString('base64url');
    mockMessages = {
      get: async () => ({
        data: {
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From',    value: 'sender@test.com' },
              { name: 'To',      value: 'me@test.com' },
              { name: 'Date',    value: '2026-04-11' },
            ],
            body: { data: bodyText },
          }
        }
      }),
    };
    const result = await read.execute({ messageId: 'm1' }, ctx);
    assert.ok(result.includes('Subject: Test Subject'));
    assert.ok(result.includes('From: sender@test.com'));
    assert.ok(result.includes('To: me@test.com'));
    assert.ok(result.includes('Hello there'));
  });

  it('passes messageId and format=full to API', async () => {
    let captured;
    const bodyText = Buffer.from('body').toString('base64url');
    mockMessages = {
      get: async (args) => {
        captured = args;
        return { data: { payload: { headers: [], body: { data: bodyText } } } };
      }
    };
    await read.execute({ messageId: 'msg123' }, ctx);
    assert.equal(captured.userId, 'me');
    assert.equal(captured.id, 'msg123');
    assert.equal(captured.format, 'full');
  });

  it('propagates API errors', async () => {
    mockMessages = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => read.execute({ messageId: 'bad' }, ctx));
  });
});

// ===========================================================================
// 6. EXECUTE TESTS — reply
// ===========================================================================
describe('reply.execute', () => {
  it('replies and returns confirmation', async () => {
    let sendArgs;
    mockMessages = {
      get: async () => ({
        data: {
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'From',       value: 'alice@test.com' },
              { name: 'Subject',    value: 'Original Subject' },
              { name: 'Message-ID', value: '<msg123@mail>' },
            ]
          }
        }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'reply1' } }; }
    };
    const result = await reply.execute({ messageId: 'orig1', body: 'Thanks!' }, ctx);
    assert.ok(result.includes('Replied to alice@test.com'));
    assert.ok(result.includes('[id: reply1]'));
    assert.equal(sendArgs.requestBody.threadId, 'thread1');
  });

  it('sets In-Reply-To and References headers', async () => {
    let sendArgs;
    mockMessages = {
      get: async () => ({
        data: {
          threadId: 't1',
          payload: {
            headers: [
              { name: 'From',       value: 'a@b.com' },
              { name: 'Subject',    value: 'Hello' },
              { name: 'Message-ID', value: '<abc@mail>' },
            ]
          }
        }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'r1' } }; }
    };
    await reply.execute({ messageId: 'orig', body: 'Reply' }, ctx);
    const raw = Buffer.from(sendArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('In-Reply-To: <abc@mail>'));
    assert.ok(raw.includes('References: <abc@mail>'));
  });

  it('prefixes subject with Re: and deduplicates', async () => {
    let sendArgs;
    mockMessages = {
      get: async () => ({
        data: {
          threadId: 't2',
          payload: {
            headers: [
              { name: 'From',       value: 'a@b.com' },
              { name: 'Subject',    value: 'Re: Already replied' },
              { name: 'Message-ID', value: '<id@mail>' },
            ]
          }
        }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'r2' } }; }
    };
    await reply.execute({ messageId: 'orig2', body: 'OK' }, ctx);
    const raw = Buffer.from(sendArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('Subject: Re: Already replied'));
    assert.ok(!raw.includes('Re: Re:'));
  });

  it('propagates API errors from get', async () => {
    mockMessages = { get: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => reply.execute({ messageId: 'bad', body: 'Hi' }, ctx));
  });

  it('propagates API errors from send', async () => {
    mockMessages = {
      get: async () => ({
        data: {
          threadId: 't',
          payload: { headers: [
            { name: 'From',       value: 'a@b.com' },
            { name: 'Subject',    value: 'S' },
            { name: 'Message-ID', value: '<id>' },
          ] }
        }
      }),
      send: async () => { throw new Error('API 500'); }
    };
    await assert.rejects(() => reply.execute({ messageId: 'orig', body: 'Hi' }, ctx));
  });
});

// ===========================================================================
// 7. EXECUTE TESTS — archive, trash, mark_read, mark_unread
// ===========================================================================
describe('archive.execute', () => {
  it('removes INBOX label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await archive.execute({ messageId: 'm1' }, ctx);
    assert.ok(result.includes('Archived'));
    assert.ok(result.includes('m1'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['INBOX']);
    assert.equal(capturedArgs.userId, 'me');
    assert.equal(capturedArgs.id, 'm1');
  });

  it('propagates API errors', async () => {
    mockMessages = { modify: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => archive.execute({ messageId: 'm1' }, ctx));
  });
});

describe('trash.execute', () => {
  it('trashes message and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = { trash: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await trash.execute({ messageId: 'm2' }, ctx);
    assert.ok(result.includes('Trashed'));
    assert.ok(result.includes('m2'));
    assert.equal(capturedArgs.userId, 'me');
    assert.equal(capturedArgs.id, 'm2');
  });

  it('propagates API errors', async () => {
    mockMessages = { trash: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => trash.execute({ messageId: 'm2' }, ctx));
  });
});

describe('mark_read.execute', () => {
  it('removes UNREAD label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await markRead.execute({ messageId: 'm3' }, ctx);
    assert.ok(result.includes('Marked as read'));
    assert.ok(result.includes('m3'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['UNREAD']);
  });

  it('propagates API errors', async () => {
    mockMessages = { modify: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => markRead.execute({ messageId: 'm3' }, ctx));
  });
});

describe('mark_unread.execute', () => {
  it('adds UNREAD label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await markUnread.execute({ messageId: 'm4' }, ctx);
    assert.ok(result.includes('Marked as unread'));
    assert.ok(result.includes('m4'));
    assert.deepEqual(capturedArgs.requestBody.addLabelIds, ['UNREAD']);
  });

  it('propagates API errors', async () => {
    mockMessages = { modify: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => markUnread.execute({ messageId: 'm4' }, ctx));
  });
});

// ===========================================================================
// 8. EXECUTE TESTS — add_label, remove_label
// ===========================================================================
describe('add_label.execute', () => {
  it('adds label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await addLabel.execute({ messageId: 'm5', labelId: 'L1' }, ctx);
    assert.ok(result.includes('Label added'));
    assert.ok(result.includes('m5'));
    assert.deepEqual(capturedArgs.requestBody.addLabelIds, ['L1']);
    assert.equal(capturedArgs.userId, 'me');
    assert.equal(capturedArgs.id, 'm5');
  });

  it('propagates API errors', async () => {
    mockMessages = { modify: async () => { throw new Error('API 404'); } };
    await assert.rejects(() => addLabel.execute({ messageId: 'm5', labelId: 'L1' }, ctx));
  });
});

describe('remove_label.execute', () => {
  it('removes label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = { modify: async (args) => { capturedArgs = args; return { data: {} }; } };
    const result = await removeLabel.execute({ messageId: 'm6', labelId: 'L2' }, ctx);
    assert.ok(result.includes('Label removed'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['L2']);
  });

  it('propagates API errors', async () => {
    mockMessages = { modify: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => removeLabel.execute({ messageId: 'm6', labelId: 'L2' }, ctx));
  });
});

// ===========================================================================
// 9. EXECUTE TESTS — create_label, list_labels
// ===========================================================================
describe('create_label.execute', () => {
  it('creates label and returns confirmation with id', async () => {
    let capturedArgs;
    mockLabels = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'Label_3' } }; }
    };
    const result = await createLabel.execute({ name: 'Urgent' }, ctx);
    assert.ok(result.includes('Label created'));
    assert.ok(result.includes('Urgent'));
    assert.ok(result.includes('[id: Label_3]'));
    assert.equal(capturedArgs.userId, 'me');
    assert.equal(capturedArgs.requestBody.name, 'Urgent');
    assert.equal(capturedArgs.requestBody.labelListVisibility, 'labelShow');
    assert.equal(capturedArgs.requestBody.messageListVisibility, 'show');
  });

  it('propagates API errors', async () => {
    mockLabels = { create: async () => { throw new Error('API 400'); } };
    await assert.rejects(() => createLabel.execute({ name: 'Bad' }, ctx));
  });
});

describe('list_labels.execute', () => {
  it('returns formatted label list', async () => {
    mockLabels = {
      list: async () => ({
        data: { labels: [{ name: 'Work', id: 'Label_1' }, { name: 'Personal', id: 'Label_2' }] }
      })
    };
    const result = await listLabels.execute({}, ctx);
    assert.ok(result.includes('Work'));
    assert.ok(result.includes('[id: Label_1]'));
    assert.ok(result.includes('Personal'));
    assert.ok(result.includes('[id: Label_2]'));
  });

  it('returns "No labels found." when empty', async () => {
    mockLabels = { list: async () => ({ data: { labels: [] } }) };
    const result = await listLabels.execute({}, ctx);
    assert.equal(result, 'No labels found.');
  });

  it('returns "No labels found." when labels is undefined', async () => {
    mockLabels = { list: async () => ({ data: {} }) };
    const result = await listLabels.execute({}, ctx);
    assert.equal(result, 'No labels found.');
  });

  it('propagates API errors', async () => {
    mockLabels = { list: async () => { throw new Error('API 500'); } };
    await assert.rejects(() => listLabels.execute({}, ctx));
  });
});

// ===========================================================================
// 10. EXECUTE TESTS — list_drafts, create_draft
// ===========================================================================
describe('list_drafts.execute', () => {
  it('returns formatted drafts list', async () => {
    mockDrafts = {
      list: async () => ({ data: { drafts: [{ id: 'd1' }] } }),
      get: async () => ({
        data: {
          message: {
            payload: {
              headers: [
                { name: 'Subject', value: 'Draft Subject' },
                { name: 'To',      value: 'bob@test.com' },
              ]
            }
          }
        }
      })
    };
    const result = await listDrafts.execute({}, ctx);
    assert.ok(result.includes('Draft Subject'));
    assert.ok(result.includes('bob@test.com'));
    assert.ok(result.includes('[id: d1]'));
  });

  it('returns "No drafts found." when empty', async () => {
    mockDrafts = { list: async () => ({ data: { drafts: [] } }) };
    const result = await listDrafts.execute({}, ctx);
    assert.equal(result, 'No drafts found.');
  });

  it('returns "No drafts found." when drafts is undefined', async () => {
    mockDrafts = { list: async () => ({ data: {} }) };
    const result = await listDrafts.execute({}, ctx);
    assert.equal(result, 'No drafts found.');
  });

  it('defaults limit to 10', async () => {
    let captured;
    mockDrafts = { list: async (args) => { captured = args; return { data: {} }; } };
    await listDrafts.execute({}, ctx);
    assert.equal(captured.maxResults, 10);
  });

  it('uses "(no subject)" when subject header is missing', async () => {
    mockDrafts = {
      list: async () => ({ data: { drafts: [{ id: 'd2' }] } }),
      get: async () => ({
        data: { message: { payload: { headers: [{ name: 'To', value: 'x@y.com' }] } } }
      })
    };
    const result = await listDrafts.execute({}, ctx);
    assert.ok(result.includes('(no subject)'));
  });

  it('propagates API errors', async () => {
    mockDrafts = { list: async () => { throw new Error('API 401'); } };
    await assert.rejects(() => listDrafts.execute({}, ctx));
  });
});

describe('create_draft.execute', () => {
  it('creates draft and returns confirmation with id', async () => {
    let capturedArgs;
    mockDrafts = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'd3' } }; }
    };
    const result = await createDraft.execute({ to: 'bob@test.com', subject: 'Draft', body: 'Content' }, ctx);
    assert.ok(result.includes('Draft created'));
    assert.ok(result.includes('Draft'));
    assert.ok(result.includes('[id: d3]'));
    assert.equal(capturedArgs.userId, 'me');
    assert.ok(capturedArgs.requestBody.message.raw);
  });

  it('raw draft message contains correct headers', async () => {
    let capturedArgs;
    mockDrafts = { create: async (args) => { capturedArgs = args; return { data: { id: 'd4' } }; } };
    await createDraft.execute({ to: 'x@y.com', subject: 'My Draft', body: 'Draft body' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.message.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('To: x@y.com'));
    assert.ok(raw.includes('Subject: My Draft'));
    assert.ok(raw.includes('Content-Type: text/plain; charset=utf-8'));
    assert.ok(raw.includes('Draft body'));
  });

  it('includes Cc header when provided', async () => {
    let capturedArgs;
    mockDrafts = { create: async (args) => { capturedArgs = args; return { data: { id: 'd5' } }; } };
    await createDraft.execute({ to: 'x@y.com', subject: 'Hi', body: 'B', cc: 'cc@test.com' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.message.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('Cc: cc@test.com'));
  });

  it('omits Cc header when not provided', async () => {
    let capturedArgs;
    mockDrafts = { create: async (args) => { capturedArgs = args; return { data: { id: 'd6' } }; } };
    await createDraft.execute({ to: 'x@y.com', subject: 'Hi', body: 'B' }, ctx);
    const raw = Buffer.from(capturedArgs.requestBody.message.raw, 'base64url').toString('utf8');
    assert.ok(!raw.includes('Cc:'));
  });

  it('propagates API errors', async () => {
    mockDrafts = { create: async () => { throw new Error('API 403'); } };
    await assert.rejects(() => createDraft.execute({ to: 'x@y.com', subject: 'Hi', body: 'B' }, ctx));
  });
});
