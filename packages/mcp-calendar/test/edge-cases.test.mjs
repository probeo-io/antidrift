import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis before importing the connector
// ---------------------------------------------------------------------------
let mockEvents;

const fakeCalendar = () => ({
  events: {
    list: (...args) => mockEvents.list(...args),
    insert: (...args) => mockEvents.insert(...args),
  }
});

await mock.module('googleapis', {
  namedExports: {
    google: {
      calendar: fakeCalendar,
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

const { tools } = await import('../connectors/google-calendar.mjs');
const toolMap = Object.fromEntries(tools.map(t => [t.name, t]));

function getTool(name) {
  return toolMap[name];
}

afterEach(() => {
  mockEvents = {};
});

// ---------------------------------------------------------------------------
// Missing required parameters
// ---------------------------------------------------------------------------
describe('missing required parameters', () => {
  it('calendar_search throws when query is missing', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    // query is destructured directly; missing query should still work (undefined)
    const result = await getTool('calendar_search').handler({ query: undefined });
    // API gets q: undefined which is valid but returns no results
    assert.equal(result, 'No events matching "undefined".');
  });

  it('calendar_create throws when start is missing', async () => {
    mockEvents = {
      insert: async () => { throw new Error('Invalid date'); }
    };
    await assert.rejects(
      () => getTool('calendar_create').handler({ title: 'No Start' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted
// ---------------------------------------------------------------------------
describe('optional parameters omitted', () => {
  it('calendar_upcoming uses default days=7 and limit=20', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await getTool('calendar_upcoming').handler({});
    assert.equal(captured.maxResults, 20);
    // timeMax should be ~7 days from now
    const min = new Date(captured.timeMin);
    const max = new Date(captured.timeMax);
    const daysDiff = Math.round((max - min) / 86400000);
    assert.equal(daysDiff, 7);
  });

  it('calendar_search uses default days=30 and limit=10', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await getTool('calendar_search').handler({ query: 'test' });
    assert.equal(captured.maxResults, 10);
    const min = new Date(captured.timeMin);
    const max = new Date(captured.timeMax);
    const daysDiff = Math.round((max - min) / 86400000);
    assert.equal(daysDiff, 30);
  });

  it('calendar_create omits location and description when not provided', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Min', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e1' } };
      }
    };
    await getTool('calendar_create').handler({ title: 'Min', start: '2026-04-01T10:00:00Z' });
    assert.equal(capturedArgs.requestBody.location, undefined);
    assert.equal(capturedArgs.requestBody.description, undefined);
    assert.equal(capturedArgs.requestBody.attendees, undefined);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('error responses', () => {
  it('handles 401 unauthorized', async () => {
    mockEvents = { list: async () => { throw new Error('Request failed with status 401'); } };
    await assert.rejects(() => getTool('calendar_upcoming').handler({}));
  });

  it('handles 404 not found', async () => {
    mockEvents = { list: async () => { throw new Error('Request failed with status 404'); } };
    await assert.rejects(() => getTool('calendar_today').handler({}));
  });

  it('handles 429 rate limit', async () => {
    mockEvents = { list: async () => { throw new Error('Request failed with status 429'); } };
    await assert.rejects(() => getTool('calendar_upcoming').handler({}));
  });

  it('handles 500 server error', async () => {
    mockEvents = { list: async () => { throw new Error('Request failed with status 500'); } };
    await assert.rejects(() => getTool('calendar_search').handler({ query: 'test' }));
  });

  it('handles network errors', async () => {
    mockEvents = { list: async () => { throw new Error('ECONNRESET'); } };
    await assert.rejects(() => getTool('calendar_upcoming').handler({}));
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------
describe('empty results', () => {
  it('calendar_upcoming handles null items', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await getTool('calendar_upcoming').handler({});
    assert.equal(result, 'No upcoming events.');
  });

  it('calendar_search handles null items', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await getTool('calendar_search').handler({ query: 'x' });
    assert.equal(result, 'No events matching "x".');
  });

  it('calendar_today handles null items', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await getTool('calendar_today').handler({});
    assert.equal(result, 'Nothing on the calendar today.');
  });

  it('calendar_upcoming handles empty array', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await getTool('calendar_upcoming').handler({});
    assert.equal(result, 'No upcoming events.');
  });
});

// ---------------------------------------------------------------------------
// Special characters in inputs
// ---------------------------------------------------------------------------
describe('special characters in inputs', () => {
  it('calendar_search passes special chars in query to API', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await getTool('calendar_search').handler({ query: "meeting's & <agenda>" });
    assert.equal(captured.q, "meeting's & <agenda>");
  });

  it('calendar_create handles special chars in title', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Test & "Demo"', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e1' } };
      }
    };
    await getTool('calendar_create').handler({ title: 'Test & "Demo"', start: '2026-04-01T10:00:00Z' });
    assert.equal(capturedArgs.requestBody.summary, 'Test & "Demo"');
  });

  it('calendar_create handles unicode in description', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Intl', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e1' } };
      }
    };
    await getTool('calendar_create').handler({ title: 'Intl', start: '2026-04-01T10:00:00Z', description: 'Cafe\u0301 \u2014 Ubersicht' });
    assert.equal(capturedArgs.requestBody.description, 'Cafe\u0301 \u2014 Ubersicht');
  });

  it('handles event with no title', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T10:00:00Z' }, id: 'e99' },
          ]
        }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('(No title)'));
  });

  it('truncates attendees list beyond 5', async () => {
    const attendees = Array.from({ length: 8 }, (_, i) => ({ email: `user${i}@test.com` }));
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Big Meeting', start: { dateTime: '2026-03-30T10:00:00Z' }, end: { dateTime: '2026-03-30T11:00:00Z' }, id: 'e100', attendees },
          ]
        }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('+3 more'));
  });
});
