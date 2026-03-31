import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis
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
// Missing required parameters
// ---------------------------------------------------------------------------
describe('missing required parameters', () => {
  it('gmail_read rejects when API throws for missing messageId', async () => {
    mockMessages = { get: async () => { throw new Error('Not Found'); } };
    await assert.rejects(() => getTool('gmail_read').handler({ messageId: undefined }));
  });

  it('gmail_send rejects when API throws for bad params', async () => {
    mockMessages = { send: async () => { throw new Error('Invalid'); } };
    await assert.rejects(() => getTool('gmail_send').handler({ to: undefined, subject: undefined, body: undefined }));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted
// ---------------------------------------------------------------------------
describe('optional parameters omitted', () => {
  it('gmail_search uses default limit=10', async () => {
    let captured;
    mockMessages = {
      list: async (args) => { captured = args; return { data: {} }; }
    };
    await getTool('gmail_search').handler({ query: 'test' });
    assert.equal(captured.maxResults, 10);
  });

  it('gmail_send omits cc/bcc headers when not provided', async () => {
    let capturedArgs;
    mockMessages = {
      send: async (args) => { capturedArgs = args; return { data: { id: 's1' } }; }
    };
    await getTool('gmail_send').handler({ to: 'x@y.com', subject: 'Hi', body: 'Body' });
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(!raw.includes('Cc:'));
    assert.ok(!raw.includes('Bcc:'));
  });

  it('gmail_create_draft omits cc header when not provided', async () => {
    let capturedArgs;
    mockDrafts = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'd1' } }; }
    };
    await getTool('gmail_create_draft').handler({ to: 'x@y.com', subject: 'Hi', body: 'Body' });
    const raw = Buffer.from(capturedArgs.requestBody.message.raw, 'base64url').toString('utf8');
    assert.ok(!raw.includes('Cc:'));
  });

  it('gmail_list_drafts uses default limit=10', async () => {
    let captured;
    mockDrafts = {
      list: async (args) => { captured = args; return { data: {} }; }
    };
    await getTool('gmail_list_drafts').handler({});
    assert.equal(captured.maxResults, 10);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('error responses', () => {
  it('handles 401 unauthorized', async () => {
    mockMessages = { list: async () => { throw new Error('Request failed with status 401'); } };
    await assert.rejects(() => getTool('gmail_search').handler({ query: 'test' }));
  });

  it('handles 404 not found on gmail_read', async () => {
    mockMessages = { get: async () => { throw new Error('Request failed with status 404'); } };
    await assert.rejects(() => getTool('gmail_read').handler({ messageId: 'bad' }));
  });

  it('handles 429 rate limit', async () => {
    mockMessages = { list: async () => { throw new Error('Request failed with status 429'); } };
    await assert.rejects(() => getTool('gmail_search').handler({ query: 'test' }));
  });

  it('handles 500 server error', async () => {
    mockLabels = { list: async () => { throw new Error('Request failed with status 500'); } };
    await assert.rejects(() => getTool('gmail_list_labels').handler({}));
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------
describe('empty results', () => {
  it('gmail_search with no messages returns message', async () => {
    mockMessages = { list: async () => ({ data: { messages: [] } }) };
    const result = await getTool('gmail_search').handler({ query: 'xyz' });
    assert.equal(result, 'No messages found.');
  });

  it('gmail_list_labels with null labels', async () => {
    mockLabels = { list: async () => ({ data: {} }) };
    const result = await getTool('gmail_list_labels').handler({});
    assert.equal(result, 'No labels found.');
  });

  it('gmail_list_drafts with empty drafts', async () => {
    mockDrafts = { list: async () => ({ data: { drafts: [] } }) };
    const result = await getTool('gmail_list_drafts').handler({});
    assert.equal(result, 'No drafts found.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in inputs
// ---------------------------------------------------------------------------
describe('special characters in inputs', () => {
  it('gmail_search passes special chars in query', async () => {
    let captured;
    mockMessages = {
      list: async (args) => { captured = args; return { data: {} }; }
    };
    await getTool('gmail_search').handler({ query: 'from:"bob <bob@test.com>" subject:re: has:attachment' });
    assert.equal(captured.q, 'from:"bob <bob@test.com>" subject:re: has:attachment');
  });

  it('gmail_send handles unicode in body', async () => {
    let capturedArgs;
    mockMessages = {
      send: async (args) => { capturedArgs = args; return { data: { id: 's1' } }; }
    };
    await getTool('gmail_send').handler({ to: 'x@y.com', subject: 'Hello', body: '\u00e9\u00e8\u00ea\u00eb \u2014 caf\u00e9' });
    const raw = Buffer.from(capturedArgs.requestBody.raw, 'base64url').toString('utf8');
    assert.ok(raw.includes('\u00e9\u00e8\u00ea\u00eb'));
  });

  it('gmail_create_label handles special chars in name', async () => {
    let capturedArgs;
    mockLabels = {
      create: async (args) => { capturedArgs = args; return { data: { id: 'L1' } }; }
    };
    await getTool('gmail_create_label').handler({ name: 'Work/Projects & "Important"' });
    assert.equal(capturedArgs.requestBody.name, 'Work/Projects & "Important"');
  });

  it('gmail_reply handles Re: prefix deduplication', async () => {
    let sendArgs;
    mockMessages = {
      get: async () => ({
        data: {
          threadId: 't1',
          payload: {
            headers: [
              { name: 'From', value: 'a@b.com' },
              { name: 'Subject', value: 'Re: Already replied' },
              { name: 'Message-ID', value: '<abc@mail>' },
            ]
          }
        }
      }),
      send: async (args) => { sendArgs = args; return { data: { id: 'r1' } }; }
    };
    await getTool('gmail_reply').handler({ messageId: 'm1', body: 'Thanks' });
    const raw = Buffer.from(sendArgs.requestBody.raw, 'base64url').toString('utf8');
    // Should not double-prefix Re: Re:
    assert.ok(raw.includes('Subject: Re: Already replied'));
    assert.ok(!raw.includes('Re: Re:'));
  });
});
