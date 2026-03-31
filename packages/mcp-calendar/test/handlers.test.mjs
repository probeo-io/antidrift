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

// Pre-mock googleapis and auth module
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
// calendar_upcoming
// ---------------------------------------------------------------------------
describe('calendar_upcoming handler', () => {
  it('returns formatted event list', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Standup', start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T09:30:00Z' }, id: 'e1' },
            { summary: 'Lunch', start: { dateTime: '2026-03-30T12:00:00Z' }, end: { dateTime: '2026-03-30T13:00:00Z' }, id: 'e2' },
          ]
        }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('Standup'));
    assert.ok(result.includes('Lunch'));
    assert.ok(result.includes('[id: e1]'));
    assert.ok(result.includes('[id: e2]'));
  });

  it('returns empty message when no events', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await getTool('calendar_upcoming').handler({});
    assert.equal(result, 'No upcoming events.');
  });

  it('returns empty message when items is null', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await getTool('calendar_upcoming').handler({});
    assert.equal(result, 'No upcoming events.');
  });

  it('passes days and limit to API call', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await getTool('calendar_upcoming').handler({ days: 14, limit: 5 });
    assert.equal(captured.maxResults, 5);
    assert.equal(captured.calendarId, 'primary');
    assert.equal(captured.singleEvents, true);
    assert.equal(captured.orderBy, 'startTime');
  });

  it('shows location when present', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Offsite', start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T17:00:00Z' }, location: 'Building 5', id: 'e3' },
          ]
        }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('Building 5'));
  });

  it('shows attendees when present', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            {
              summary: 'Meeting', start: { dateTime: '2026-03-30T10:00:00Z' }, end: { dateTime: '2026-03-30T11:00:00Z' }, id: 'e4',
              attendees: [{ email: 'alice@test.com', displayName: 'Alice' }, { email: 'bob@test.com' }]
            },
          ]
        }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('bob@test.com'));
  });

  it('shows all-day events', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Holiday', start: { date: '2026-03-30' }, end: { date: '2026-03-31' }, id: 'e5' },
          ]
        }
      })
    };
    const result = await getTool('calendar_upcoming').handler({});
    assert.ok(result.includes('Holiday'));
    assert.ok(result.includes('All day'));
  });
});

// ---------------------------------------------------------------------------
// calendar_search
// ---------------------------------------------------------------------------
describe('calendar_search handler', () => {
  it('returns matching events', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Design Review', start: { dateTime: '2026-04-01T14:00:00Z' }, end: { dateTime: '2026-04-01T15:00:00Z' }, id: 'e6' },
          ]
        }
      })
    };
    const result = await getTool('calendar_search').handler({ query: 'Design' });
    assert.ok(result.includes('Design Review'));
    assert.ok(result.includes('[id: e6]'));
  });

  it('passes query to API', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await getTool('calendar_search').handler({ query: 'standup' });
    assert.equal(captured.q, 'standup');
    assert.equal(captured.calendarId, 'primary');
  });

  it('returns empty message when no matches', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await getTool('calendar_search').handler({ query: 'nonexistent' });
    assert.equal(result, 'No events matching "nonexistent".');
  });
});

// ---------------------------------------------------------------------------
// calendar_create
// ---------------------------------------------------------------------------
describe('calendar_create handler', () => {
  it('creates event and returns confirmation', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return {
          data: {
            summary: 'New Meeting', start: { dateTime: '2026-04-01T10:00:00.000Z' },
            end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e7'
          }
        };
      }
    };
    const result = await getTool('calendar_create').handler({ title: 'New Meeting', start: '2026-04-01T10:00:00Z' });
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('New Meeting'));
    assert.equal(capturedArgs.calendarId, 'primary');
    assert.equal(capturedArgs.requestBody.summary, 'New Meeting');
    assert.equal(capturedArgs.sendUpdates, 'all');
  });

  it('defaults end to 1 hour after start', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Quick', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e8' } };
      }
    };
    await getTool('calendar_create').handler({ title: 'Quick', start: '2026-04-01T10:00:00Z' });
    const endDt = new Date(capturedArgs.requestBody.end.dateTime);
    const startDt = new Date(capturedArgs.requestBody.start.dateTime);
    assert.equal(endDt - startDt, 3600000);
  });

  it('includes location when provided', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Offsite', start: { dateTime: '2026-04-01T09:00:00.000Z' }, end: { dateTime: '2026-04-01T17:00:00.000Z' }, id: 'e9', location: 'HQ' } };
      }
    };
    await getTool('calendar_create').handler({ title: 'Offsite', start: '2026-04-01T09:00:00Z', end: '2026-04-01T17:00:00Z', location: 'HQ' });
    assert.equal(capturedArgs.requestBody.location, 'HQ');
  });

  it('includes attendees when provided', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Sync', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'e10' } };
      }
    };
    await getTool('calendar_create').handler({ title: 'Sync', start: '2026-04-01T10:00:00Z', attendees: 'a@b.com, c@d.com' });
    assert.deepEqual(capturedArgs.requestBody.attendees, [{ email: 'a@b.com' }, { email: 'c@d.com' }]);
  });
});

// ---------------------------------------------------------------------------
// calendar_today
// ---------------------------------------------------------------------------
describe('calendar_today handler', () => {
  it('returns today events', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Morning standup', start: { dateTime: '2026-03-30T09:00:00Z' }, end: { dateTime: '2026-03-30T09:15:00Z' }, id: 'e11' },
          ]
        }
      })
    };
    const result = await getTool('calendar_today').handler({});
    assert.ok(result.includes('Morning standup'));
  });

  it('returns empty message when nothing today', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await getTool('calendar_today').handler({});
    assert.equal(result, 'Nothing on the calendar today.');
  });

  it('passes correct time range for today', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await getTool('calendar_today').handler({});
    assert.equal(captured.calendarId, 'primary');
    assert.equal(captured.singleEvents, true);
    assert.equal(captured.orderBy, 'startTime');
    // timeMin should be start of today, timeMax should be end of today
    const min = new Date(captured.timeMin);
    const max = new Date(captured.timeMax);
    assert.equal(max - min, 86400000);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('calendar error handling', () => {
  it('propagates API errors', async () => {
    mockEvents = {
      list: async () => { throw new Error('API error: 401 Unauthorized'); }
    };
    await assert.rejects(
      () => getTool('calendar_upcoming').handler({}),
      (err) => {
        assert.ok(err.message.includes('401'));
        return true;
      }
    );
  });

  it('propagates errors from insert', async () => {
    mockEvents = {
      insert: async () => { throw new Error('API error: 403 Forbidden'); }
    };
    await assert.rejects(
      () => getTool('calendar_create').handler({ title: 'Test', start: '2026-04-01T10:00:00Z' }),
      (err) => {
        assert.ok(err.message.includes('403'));
        return true;
      }
    );
  });
});
