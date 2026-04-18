/**
 * Comprehensive unit tests for mcp-calendar zeromcp tool files.
 *
 * Tests three layers:
 *   1. Structure — each tools/*.mjs exports valid { description, input, execute }
 *   2. Pure functions — formatEvent() in lib/client.mjs
 *   3. Execute behaviour — tools wired to a mocked googleapis calendar client
 */

import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock googleapis and auth-google BEFORE any tool files are imported
// ---------------------------------------------------------------------------
let mockEvents = {};

const fakeCalendar = () => ({
  events: {
    list:   (...a) => mockEvents.list(...a),
    insert: (...a) => mockEvents.insert(...a),
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

// Import tool files after mocks are installed
const todayMod    = await import('../tools/today.mjs');
const upcomingMod = await import('../tools/upcoming.mjs');
const searchMod   = await import('../tools/search.mjs');
const createMod   = await import('../tools/create.mjs');

const today    = todayMod.default;
const upcoming = upcomingMod.default;
const search   = searchMod.default;
const create   = createMod.default;

// Import pure formatting function directly
const { formatEvent } = await import('../lib/client.mjs');

// Minimal ctx object (credentials are ignored by the mock createClient)
const ctx = { credentials: {} };

afterEach(() => { mockEvents = {}; });

// ===========================================================================
// 1. STRUCTURE TESTS — every zeromcp tool file
// ===========================================================================
describe('zeromcp tool structure', () => {
  const tools = [
    { name: 'today',    mod: today },
    { name: 'upcoming', mod: upcoming },
    { name: 'search',   mod: search },
    { name: 'create',   mod: create },
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

  it('today: input has no required fields', () => {
    const required = Object.values(today.input).filter(v => v.required);
    assert.equal(required.length, 0);
  });

  it('upcoming: optional days and limit fields have type number', () => {
    assert.equal(upcoming.input.days?.type, 'number');
    assert.equal(upcoming.input.limit?.type, 'number');
  });

  it('search: query is required and is type string', () => {
    assert.equal(search.input.query?.type, 'string');
    assert.ok(search.input.query && search.input.query?.optional !== true);
  });

  it('create: title and start are required strings', () => {
    assert.equal(create.input.title?.type, 'string');
    assert.ok(create.input.title && create.input.title?.optional !== true);
    assert.equal(create.input.start?.type, 'string');
    assert.ok(create.input.start && create.input.start?.optional !== true);
  });

  it('create: end, location, description, attendees are optional strings', () => {
    for (const key of ['end', 'location', 'description', 'attendees']) {
      assert.equal(create.input[key]?.type, 'string',
        `create.input.${key} should be type string`);
      assert.ok(!create.input[key]?.required,
        `create.input.${key} should not be required`);
    }
  });
});

// ===========================================================================
// 2. PURE FUNCTION TESTS — formatEvent()
// ===========================================================================
describe('formatEvent()', () => {
  it('formats a timed event with summary, date, and id', () => {
    const event = {
      summary: 'Team Sync',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt1'
    };
    const result = formatEvent(event);
    assert.ok(result.includes('Team Sync'));
    assert.ok(result.includes('[id: evt1]'));
  });

  it('uses "(No title)" when summary is missing', () => {
    const event = {
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt2'
    };
    const result = formatEvent(event);
    assert.ok(result.includes('(No title)'));
    assert.ok(result.includes('[id: evt2]'));
  });

  it('shows "All day" for all-day events (date only)', () => {
    const event = {
      summary: 'Holiday',
      start: { date: '2026-04-01' },
      end:   { date: '2026-04-02' },
      id: 'evt3'
    };
    const result = formatEvent(event);
    assert.ok(result.includes('All day'));
    assert.ok(result.includes('Holiday'));
  });

  it('includes location when present', () => {
    const event = {
      summary: 'Offsite',
      start: { dateTime: '2026-04-01T09:00:00Z' },
      end:   { dateTime: '2026-04-01T17:00:00Z' },
      location: 'Conference Room B',
      id: 'evt4'
    };
    const result = formatEvent(event);
    assert.ok(result.includes('Conference Room B'));
  });

  it('does not include location line when absent', () => {
    const event = {
      summary: 'Standup',
      start: { dateTime: '2026-04-01T09:00:00Z' },
      end:   { dateTime: '2026-04-01T09:15:00Z' },
      id: 'evt5'
    };
    const result = formatEvent(event);
    assert.ok(!result.includes('undefined'));
  });

  it('includes attendee display names when present', () => {
    const event = {
      summary: 'Meeting',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt6',
      attendees: [
        { displayName: 'Alice', email: 'alice@test.com' },
        { email: 'bob@test.com' }
      ]
    };
    const result = formatEvent(event);
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('bob@test.com'));
  });

  it('falls back to email when displayName is absent', () => {
    const event = {
      summary: 'Call',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T10:30:00Z' },
      id: 'evt7',
      attendees: [{ email: 'carol@test.com' }]
    };
    const result = formatEvent(event);
    assert.ok(result.includes('carol@test.com'));
  });

  it('limits attendees to 5 and appends "+N more"', () => {
    const attendees = Array.from({ length: 8 }, (_, i) => ({ email: `user${i}@test.com` }));
    const event = {
      summary: 'Big Meeting',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt8',
      attendees
    };
    const result = formatEvent(event);
    assert.ok(result.includes('+3 more'));
    // Only first 5 shown
    assert.ok(result.includes('user0@test.com'));
    assert.ok(!result.includes('user7@test.com'));
  });

  it('exactly 5 attendees — no "+N more"', () => {
    const attendees = Array.from({ length: 5 }, (_, i) => ({ email: `u${i}@test.com` }));
    const event = {
      summary: 'Five',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt9',
      attendees
    };
    const result = formatEvent(event);
    assert.ok(!result.includes('more'));
  });

  it('handles empty attendees array gracefully', () => {
    const event = {
      summary: 'Solo',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt10',
      attendees: []
    };
    const result = formatEvent(event);
    assert.ok(result.includes('Solo'));
    assert.ok(!result.includes('more'));
  });

  it('includes the calendar emoji and em-dash', () => {
    const event = {
      summary: 'Check',
      start: { dateTime: '2026-04-01T10:00:00Z' },
      end:   { dateTime: '2026-04-01T11:00:00Z' },
      id: 'evt11'
    };
    const result = formatEvent(event);
    assert.ok(result.includes('📅'));
    assert.ok(result.includes('—'));
  });
});

// ===========================================================================
// 3. EXECUTE TESTS — today
// ===========================================================================
describe('today.execute', () => {
  it('returns formatted events for today', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Morning Standup', start: { dateTime: '2026-04-11T09:00:00Z' }, end: { dateTime: '2026-04-11T09:15:00Z' }, id: 'e1' },
          ]
        }
      })
    };
    const result = await today.execute({}, ctx);
    assert.ok(result.includes('Morning Standup'));
    assert.ok(result.includes('[id: e1]'));
  });

  it('returns "Nothing on the calendar today." when empty', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await today.execute({}, ctx);
    assert.equal(result, 'Nothing on the calendar today.');
  });

  it('returns empty message when items is undefined', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await today.execute({}, ctx);
    assert.equal(result, 'Nothing on the calendar today.');
  });

  it('calls API with calendarId=primary, singleEvents=true, orderBy=startTime', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await today.execute({}, ctx);
    assert.equal(captured.calendarId, 'primary');
    assert.equal(captured.singleEvents, true);
    assert.equal(captured.orderBy, 'startTime');
  });

  it('timeMax is exactly 24 hours after timeMin', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await today.execute({}, ctx);
    const min = new Date(captured.timeMin);
    const max = new Date(captured.timeMax);
    assert.equal(max - min, 86400000);
  });

  it('timeMin is midnight of today (hours/minutes/seconds = 0)', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await today.execute({}, ctx);
    const min = new Date(captured.timeMin);
    assert.equal(min.getHours(), 0);
    assert.equal(min.getMinutes(), 0);
    assert.equal(min.getSeconds(), 0);
  });

  it('propagates API errors', async () => {
    mockEvents = { list: async () => { throw new Error('API 401 Unauthorized'); } };
    await assert.rejects(
      () => today.execute({}, ctx),
      (err) => { assert.ok(err.message.includes('401')); return true; }
    );
  });

  it('returns multiple events separated by double-newlines', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'A', start: { dateTime: '2026-04-11T09:00:00Z' }, end: { dateTime: '2026-04-11T10:00:00Z' }, id: 'a1' },
            { summary: 'B', start: { dateTime: '2026-04-11T11:00:00Z' }, end: { dateTime: '2026-04-11T12:00:00Z' }, id: 'b1' },
          ]
        }
      })
    };
    const result = await today.execute({}, ctx);
    assert.ok(result.includes('A'));
    assert.ok(result.includes('B'));
    assert.ok(result.includes('\n\n'));
  });
});

// ===========================================================================
// 4. EXECUTE TESTS — upcoming
// ===========================================================================
describe('upcoming.execute', () => {
  it('returns formatted upcoming events', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Sprint Review', start: { dateTime: '2026-04-15T14:00:00Z' }, end: { dateTime: '2026-04-15T15:00:00Z' }, id: 'u1' },
          ]
        }
      })
    };
    const result = await upcoming.execute({}, ctx);
    assert.ok(result.includes('Sprint Review'));
    assert.ok(result.includes('[id: u1]'));
  });

  it('returns "No upcoming events." when empty', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await upcoming.execute({}, ctx);
    assert.equal(result, 'No upcoming events.');
  });

  it('returns empty message when items is undefined', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await upcoming.execute({}, ctx);
    assert.equal(result, 'No upcoming events.');
  });

  it('defaults to days=7 and limit=20', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await upcoming.execute({}, ctx);
    assert.equal(captured.maxResults, 20);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 7);
  });

  it('respects custom days and limit', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await upcoming.execute({ days: 14, limit: 5 }, ctx);
    assert.equal(captured.maxResults, 5);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 14);
  });

  it('passes singleEvents=true and orderBy=startTime', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await upcoming.execute({}, ctx);
    assert.equal(captured.singleEvents, true);
    assert.equal(captured.orderBy, 'startTime');
    assert.equal(captured.calendarId, 'primary');
  });

  it('propagates API errors', async () => {
    mockEvents = { list: async () => { throw new Error('API 429 Rate Limit'); } };
    await assert.rejects(
      () => upcoming.execute({}, ctx),
      (err) => { assert.ok(err.message.includes('429')); return true; }
    );
  });
});

// ===========================================================================
// 5. EXECUTE TESTS — search
// ===========================================================================
describe('search.execute', () => {
  it('returns matching events', async () => {
    mockEvents = {
      list: async () => ({
        data: {
          items: [
            { summary: 'Design Review', start: { dateTime: '2026-04-20T14:00:00Z' }, end: { dateTime: '2026-04-20T15:00:00Z' }, id: 's1' },
          ]
        }
      })
    };
    const result = await search.execute({ query: 'Design' }, ctx);
    assert.ok(result.includes('Design Review'));
    assert.ok(result.includes('[id: s1]'));
  });

  it('returns no-match message when empty', async () => {
    mockEvents = { list: async () => ({ data: { items: [] } }) };
    const result = await search.execute({ query: 'nonexistent' }, ctx);
    assert.equal(result, 'No events matching "nonexistent".');
  });

  it('returns no-match message when items is undefined', async () => {
    mockEvents = { list: async () => ({ data: {} }) };
    const result = await search.execute({ query: 'test' }, ctx);
    assert.equal(result, 'No events matching "test".');
  });

  it('passes query string as q to API', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await search.execute({ query: 'standup' }, ctx);
    assert.equal(captured.q, 'standup');
    assert.equal(captured.calendarId, 'primary');
  });

  it('defaults to days=30 and limit=10', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await search.execute({ query: 'x' }, ctx);
    assert.equal(captured.maxResults, 10);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 30);
  });

  it('respects custom days and limit', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await search.execute({ query: 'x', days: 7, limit: 3 }, ctx);
    assert.equal(captured.maxResults, 3);
    const diffDays = Math.round((new Date(captured.timeMax) - new Date(captured.timeMin)) / 86400000);
    assert.equal(diffDays, 7);
  });

  it('passes special characters in query unchanged', async () => {
    let captured;
    mockEvents = {
      list: async (args) => { captured = args; return { data: { items: [] } }; }
    };
    await search.execute({ query: "meeting's & <notes>" }, ctx);
    assert.equal(captured.q, "meeting's & <notes>");
  });

  it('propagates API errors', async () => {
    mockEvents = { list: async () => { throw new Error('API 500 Server Error'); } };
    await assert.rejects(
      () => search.execute({ query: 'test' }, ctx),
      (err) => { assert.ok(err.message.includes('500')); return true; }
    );
  });
});

// ===========================================================================
// 6. EXECUTE TESTS — create
// ===========================================================================
describe('create.execute', () => {
  it('creates event and returns confirmation string', async () => {
    mockEvents = {
      insert: async () => ({
        data: {
          summary: 'New Meeting',
          start: { dateTime: '2026-04-01T10:00:00.000Z' },
          end:   { dateTime: '2026-04-01T11:00:00.000Z' },
          id: 'c1'
        }
      })
    };
    const result = await create.execute({ title: 'New Meeting', start: '2026-04-01T10:00:00Z' }, ctx);
    assert.ok(result.includes('Created'));
    assert.ok(result.includes('New Meeting'));
  });

  it('sends correct summary, start, and end to API', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'T', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c2' } };
      }
    };
    await create.execute({ title: 'T', start: '2026-04-01T10:00:00Z', end: '2026-04-01T11:30:00Z' }, ctx);
    assert.equal(capturedArgs.requestBody.summary, 'T');
    assert.equal(capturedArgs.calendarId, 'primary');
    assert.equal(capturedArgs.sendUpdates, 'all');
  });

  it('defaults end to 1 hour after start when omitted', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Q', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c3' } };
      }
    };
    await create.execute({ title: 'Q', start: '2026-04-01T10:00:00Z' }, ctx);
    const endDt   = new Date(capturedArgs.requestBody.end.dateTime);
    const startDt = new Date(capturedArgs.requestBody.start.dateTime);
    assert.equal(endDt - startDt, 3600000);
  });

  it('includes location in requestBody when provided', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Offsite', start: { dateTime: '2026-04-01T09:00:00.000Z' }, end: { dateTime: '2026-04-01T17:00:00.000Z' }, id: 'c4', location: 'HQ' } };
      }
    };
    await create.execute({ title: 'Offsite', start: '2026-04-01T09:00:00Z', location: 'HQ' }, ctx);
    assert.equal(capturedArgs.requestBody.location, 'HQ');
  });

  it('includes description in requestBody when provided', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'D', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c5' } };
      }
    };
    await create.execute({ title: 'D', start: '2026-04-01T10:00:00Z', description: 'Agenda notes' }, ctx);
    assert.equal(capturedArgs.requestBody.description, 'Agenda notes');
  });

  it('parses comma-separated attendees into email objects', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Sync', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c6' } };
      }
    };
    await create.execute({ title: 'Sync', start: '2026-04-01T10:00:00Z', attendees: 'a@b.com, c@d.com' }, ctx);
    assert.deepEqual(capturedArgs.requestBody.attendees, [{ email: 'a@b.com' }, { email: 'c@d.com' }]);
  });

  it('omits location, description, attendees when not provided', async () => {
    let capturedArgs;
    mockEvents = {
      insert: async (args) => {
        capturedArgs = args;
        return { data: { summary: 'Min', start: { dateTime: '2026-04-01T10:00:00.000Z' }, end: { dateTime: '2026-04-01T11:00:00.000Z' }, id: 'c7' } };
      }
    };
    await create.execute({ title: 'Min', start: '2026-04-01T10:00:00Z' }, ctx);
    assert.equal(capturedArgs.requestBody.location, undefined);
    assert.equal(capturedArgs.requestBody.description, undefined);
    assert.equal(capturedArgs.requestBody.attendees, undefined);
  });

  it('propagates API errors from insert', async () => {
    mockEvents = { insert: async () => { throw new Error('API 403 Forbidden'); } };
    await assert.rejects(
      () => create.execute({ title: 'T', start: '2026-04-01T10:00:00Z' }, ctx),
      (err) => { assert.ok(err.message.includes('403')); return true; }
    );
  });
});
