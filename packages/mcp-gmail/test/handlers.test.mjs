import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis before importing the connector
// ---------------------------------------------------------------------------
let mockMessages, mockLabels, mockDrafts;

const fakeGmail = () => ({
  users: {
    messages: {
      list: (...a) => mockMessages.list(...a),
      get: (...a) => mockMessages.get(...a),
      send: (...a) => mockMessages.send(...a),
      modify: (...a) => mockMessages.modify(...a),
      trash: (...a) => mockMessages.trash(...a),
    },
    labels: {
      list: (...a) => mockLabels.list(...a),
      create: (...a) => mockLabels.create(...a),
    },
    drafts: {
      list: (...a) => mockDrafts.list(...a),
      get: (...a) => mockDrafts.get(...a),
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

const { tools } = await import('../connectors/google-gmail.mjs');
const toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
function getTool(name) { return toolMap[name]; }

afterEach(() => {
  mockMessages = {}; mockLabels = {}; mockDrafts = {};
});

// ---------------------------------------------------------------------------
// gmail_search
// ---------------------------------------------------------------------------
describe('gmail_search handler', () => {
  it('returns formatted message list', async () => {
    mockMessages = {
      list: async () => ({ data: { messages: [{ id: 'm1' }, { id: 'm2' }] } }),
      get: async (args) => ({
        data: {
          payload: {
            headers: [
              { name: 'From', value: args.id === 'm1' ? 'alice@test.com' : 'bob@test.com' },
              { name: 'Subject', value: args.id === 'm1' ? 'Invoice' : 'Receipt' },
              { name: 'Date', value: '2026-03-30' },
            ]
          }
        }
      }),
    };
    const result = await getTool('gmail_search').handler({ query: 'invoice' });
    assert.ok(result.includes('Invoice'));
    assert.ok(result.includes('alice@test.com'));
    assert.ok(result.includes('[id: m1]'));
    assert.ok(result.includes('Receipt'));
  });

  it('returns empty message when no results', async () => {
    mockMessages = { list: async () => ({ data: {} }) };
    const result = await getTool('gmail_search').handler({ query: 'nothing' });
    assert.equal(result, 'No messages found.');
  });

  it('passes query and limit to API', async () => {
    let captured;
    mockMessages = {
      list: async (args) => { captured = args; return { data: {} }; }
    };
    await getTool('gmail_search').handler({ query: 'from:bob', limit: 5 });
    assert.equal(captured.q, 'from:bob');
    assert.equal(captured.maxResults, 5);
    assert.equal(captured.userId, 'me');
  });
});

// ---------------------------------------------------------------------------
// gmail_read
// ---------------------------------------------------------------------------
describe('gmail_read handler', () => {
  it('returns formatted message', async () => {
    const bodyText = Buffer.from('Hello there').toString('base64url');
    mockMessages = {
      get: async () => ({
        data: {
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From', value: 'sender@test.com' },
              { name: 'To', value: 'me@test.com' },
              { name: 'Date', value: '2026-03-30' },
            ],
            body: { data: bodyText },
          }
        }
      }),
    };
    const result = await getTool('gmail_read').handler({ messageId: 'm1' });
    assert.ok(result.includes('Subject: Test Subject'));
    assert.ok(result.includes('From: sender@test.com'));
    assert.ok(result.includes('To: me@test.com'));
    assert.ok(result.includes('Hello there'));
  });

  it('passes correct params to API', async () => {
    let captured;
    const bodyText = Buffer.from('body').toString('base64url');
    mockMessages = {
      get: async (args) => {
        captured = args;
        return { data: { payload: { headers: [], body: { data: bodyText } } } };
      }
    };
    await getTool('gmail_read').handler({ messageId: 'msg123' });
    assert.equal(captured.userId, 'me');
    assert.equal(captured.id, 'msg123');
    assert.equal(captured.format, 'full');
  });
});

// ---------------------------------------------------------------------------
// gmail_send
// ---------------------------------------------------------------------------
describe('gmail_send handler', () => {
  it('sends email and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = {
      send: async (args) => { capturedArgs = args; return { data: { id: 'sent1' } }; }
    };
    const result = await getTool('gmail_send').handler({ to: 'bob@test.com', subject: 'Hi', body: 'Hello' });
    assert.ok(result.includes('Sent to bob@test.com'));
    assert.ok(result.includes('[id: sent1]'));
    assert.equal(capturedArgs.userId, 'me');
    assert.ok(capturedArgs.requestBody.raw);
  });

  it('includes cc and bcc in raw message', async () => {
    let capturedArgs;
    mockMessages = {
      send: async (args) => { capturedArgs = args; return { data: { id: 'sent2' } }; }
    };
    await getTool('gmail_send').handler({ to: 'bob@test.com', subject: 'Hi', body: 'Hello', cc: 'cc@test.com', bcc: 'bcc@test.com' });
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('Cc: cc@test.com'));
    assert.ok(raw.includes('Bcc: bcc@test.com'));
  });
});

// ---------------------------------------------------------------------------
// gmail_reply
// ---------------------------------------------------------------------------
describe('gmail_reply handler', () => {
  it('replies and returns confirmation', async () => {
    let sendArgs;
    mockMessages = {
      get: async () => ({
        data: {
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'From', value: 'alice@test.com' },
              { name: 'Subject', value: 'Original Subject' },
              { name: 'Message-ID', value: '<msg123@mail>' },
            ]
          }
        }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'reply1' } }; }
    };
    const result = await getTool('gmail_reply').handler({ messageId: 'orig1', body: 'Thanks!' });
    assert.ok(result.includes('Replied to alice@test.com'));
    assert.ok(result.includes('[id: reply1]'));
    assert.equal(sendArgs.requestBody.threadId, 'thread1');
    const raw = Buffer.from(sendArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('In-Reply-To: <msg123@mail>'));
    assert.ok(raw.includes('Re: Original Subject'));
  });
});

// ---------------------------------------------------------------------------
// gmail_list_labels
// ---------------------------------------------------------------------------
describe('gmail_list_labels handler', () => {
  it('returns formatted labels', async () => {
    mockLabels = {
      list: async () => ({
        data: { labels: [{ name: 'Work', id: 'Label_1' }, { name: 'Personal', id: 'Label_2' }] }
      })
    };
    const result = await getTool('gmail_list_labels').handler({});
    assert.ok(result.includes('Work'));
    assert.ok(result.includes('[id: Label_1]'));
    assert.ok(result.includes('Personal'));
  });

  it('returns empty message when no labels', async () => {
    mockLabels = { list: async () => ({ data: { labels: [] } }) };
    const result = await getTool('gmail_list_labels').handler({});
    assert.equal(result, 'No labels found.');
  });
});

// ---------------------------------------------------------------------------
// gmail_create_label
// ---------------------------------------------------------------------------
describe('gmail_create_label handler', () => {
  it('creates label and returns confirmation', async () => {
    let capturedArgs;
    mockLabels = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'Label_3' } }; }
    };
    const result = await getTool('gmail_create_label').handler({ name: 'Urgent' });
    assert.ok(result.includes('Label created'));
    assert.ok(result.includes('Urgent'));
    assert.ok(result.includes('[id: Label_3]'));
    assert.equal(capturedArgs.requestBody.name, 'Urgent');
  });
});

// ---------------------------------------------------------------------------
// gmail_add_label / gmail_remove_label
// ---------------------------------------------------------------------------
describe('gmail_add_label handler', () => {
  it('adds label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = {
      modify: async (args) => { capturedArgs = args; return { data: {} }; }
    };
    const result = await getTool('gmail_add_label').handler({ messageId: 'm1', labelId: 'L1' });
    assert.ok(result.includes('Label added'));
    assert.ok(result.includes('m1'));
    assert.deepEqual(capturedArgs.requestBody.addLabelIds, ['L1']);
  });
});

describe('gmail_remove_label handler', () => {
  it('removes label and returns confirmation', async () => {
    let capturedArgs;
    mockMessages = {
      modify: async (args) => { capturedArgs = args; return { data: {} }; }
    };
    const result = await getTool('gmail_remove_label').handler({ messageId: 'm1', labelId: 'L1' });
    assert.ok(result.includes('Label removed'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['L1']);
  });
});

// ---------------------------------------------------------------------------
// gmail_archive
// ---------------------------------------------------------------------------
describe('gmail_archive handler', () => {
  it('archives message', async () => {
    let capturedArgs;
    mockMessages = {
      modify: async (args) => { capturedArgs = args; return { data: {} }; }
    };
    const result = await getTool('gmail_archive').handler({ messageId: 'm1' });
    assert.ok(result.includes('Archived'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['INBOX']);
  });
});

// ---------------------------------------------------------------------------
// gmail_trash
// ---------------------------------------------------------------------------
describe('gmail_trash handler', () => {
  it('trashes message', async () => {
    let capturedArgs;
    mockMessages = {
      trash: async (args) => { capturedArgs = args; return { data: {} }; }
    };
    const result = await getTool('gmail_trash').handler({ messageId: 'm1' });
    assert.ok(result.includes('Trashed'));
    assert.equal(capturedArgs.userId, 'me');
    assert.equal(capturedArgs.id, 'm1');
  });
});

// ---------------------------------------------------------------------------
// gmail_mark_read / gmail_mark_unread
// ---------------------------------------------------------------------------
describe('gmail_mark_read handler', () => {
  it('removes UNREAD label', async () => {
    let capturedArgs;
    mockMessages = {
      modify: async (args) => { capturedArgs = args; return { data: {} }; }
    };
    const result = await getTool('gmail_mark_read').handler({ messageId: 'm1' });
    assert.ok(result.includes('Marked as read'));
    assert.deepEqual(capturedArgs.requestBody.removeLabelIds, ['UNREAD']);
  });
});

describe('gmail_mark_unread handler', () => {
  it('adds UNREAD label', async () => {
    let capturedArgs;
    mockMessages = {
      modify: async (args) => { capturedArgs = args; return { data: {} }; }
    };
    const result = await getTool('gmail_mark_unread').handler({ messageId: 'm1' });
    assert.ok(result.includes('Marked as unread'));
    assert.deepEqual(capturedArgs.requestBody.addLabelIds, ['UNREAD']);
  });
});

// ---------------------------------------------------------------------------
// gmail_list_drafts
// ---------------------------------------------------------------------------
describe('gmail_list_drafts handler', () => {
  it('returns formatted drafts', async () => {
    mockDrafts = {
      list: async () => ({ data: { drafts: [{ id: 'd1' }] } }),
      get: async () => ({
        data: {
          message: {
            payload: {
              headers: [
                { name: 'Subject', value: 'Draft Subject' },
                { name: 'To', value: 'bob@test.com' },
              ]
            }
          }
        }
      })
    };
    const result = await getTool('gmail_list_drafts').handler({});
    assert.ok(result.includes('Draft Subject'));
    assert.ok(result.includes('bob@test.com'));
    assert.ok(result.includes('[id: d1]'));
  });

  it('returns empty message when no drafts', async () => {
    mockDrafts = { list: async () => ({ data: { drafts: [] } }) };
    const result = await getTool('gmail_list_drafts').handler({});
    assert.equal(result, 'No drafts found.');
  });

  it('returns empty message when drafts is null', async () => {
    mockDrafts = { list: async () => ({ data: {} }) };
    const result = await getTool('gmail_list_drafts').handler({});
    assert.equal(result, 'No drafts found.');
  });
});

// ---------------------------------------------------------------------------
// gmail_create_draft
// ---------------------------------------------------------------------------
describe('gmail_create_draft handler', () => {
  it('creates draft and returns confirmation', async () => {
    let capturedArgs;
    mockDrafts = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'd2' } }; }
    };
    const result = await getTool('gmail_create_draft').handler({ to: 'bob@test.com', subject: 'Draft', body: 'Content' });
    assert.ok(result.includes('Draft created'));
    assert.ok(result.includes('[id: d2]'));
    assert.equal(capturedArgs.userId, 'me');
    assert.ok(capturedArgs.requestBody.message.raw);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('gmail error handling', () => {
  it('propagates 401 error', async () => {
    mockMessages = { list: async () => { throw new Error('Request failed with status 401'); } };
    await assert.rejects(() => getTool('gmail_search').handler({ query: 'test' }));
  });

  it('propagates 500 error', async () => {
    mockLabels = { list: async () => { throw new Error('Request failed with status 500'); } };
    await assert.rejects(() => getTool('gmail_list_labels').handler({}));
  });
});
