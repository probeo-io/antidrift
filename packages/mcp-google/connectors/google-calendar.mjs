import { google } from 'googleapis';
import { getAuthClient } from '../auth-google.mjs';

let calApi = null;

function getCal() {
  if (!calApi) {
    calApi = google.calendar({ version: 'v3', auth: getAuthClient() });
  }
  return calApi;
}

function formatEvent(e) {
  const start = e.start?.dateTime || e.start?.date || '';
  const end = e.end?.dateTime || e.end?.date || '';

  const startDate = new Date(start);
  const isAllDay = !e.start?.dateTime;
  const time = isAllDay ? 'All day' : startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const date = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  let line = `📅 ${e.summary || '(No title)'}  —  ${date}, ${time}`;
  if (e.location) line += `\n   📍 ${e.location}`;
  if (e.attendees?.length) {
    const names = e.attendees.map(a => a.displayName || a.email).slice(0, 5);
    line += `\n   👥 ${names.join(', ')}`;
    if (e.attendees.length > 5) line += ` +${e.attendees.length - 5} more`;
  }
  line += `  [id: ${e.id}]`;
  return line;
}

export const tools = [
  {
    name: 'calendar_upcoming',
    description: 'Show upcoming calendar events. Defaults to the next 7 days.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look ahead (default 7)' },
        limit: { type: 'number', description: 'Max events (default 20)' }
      }
    },
    handler: async ({ days = 7, limit = 20 }) => {
      const now = new Date();
      const until = new Date(now.getTime() + days * 86400000);

      const res = await getCal().events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: until.toISOString(),
        maxResults: limit,
        singleEvents: true,
        orderBy: 'startTime'
      });

      if (!res.data.items?.length) return 'No upcoming events.';
      return res.data.items.map(formatEvent).join('\n\n');
    }
  },
  {
    name: 'calendar_search',
    description: 'Search calendar events by keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        days: { type: 'number', description: 'How many days to search ahead (default 30)' },
        limit: { type: 'number', description: 'Max events (default 10)' }
      },
      required: ['query']
    },
    handler: async ({ query, days = 30, limit = 10 }) => {
      const now = new Date();
      const until = new Date(now.getTime() + days * 86400000);

      const res = await getCal().events.list({
        calendarId: 'primary',
        q: query,
        timeMin: now.toISOString(),
        timeMax: until.toISOString(),
        maxResults: limit,
        singleEvents: true,
        orderBy: 'startTime'
      });

      if (!res.data.items?.length) return `No events matching "${query}".`;
      return res.data.items.map(formatEvent).join('\n\n');
    }
  },
  {
    name: 'calendar_create',
    description: 'Create a calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        start: { type: 'string', description: 'Start time (ISO 8601 or natural like "2026-03-25T10:00:00")' },
        end: { type: 'string', description: 'End time (ISO 8601). If omitted, defaults to 1 hour after start.' },
        location: { type: 'string', description: 'Location (optional)' },
        description: { type: 'string', description: 'Event description (optional)' },
        attendees: { type: 'string', description: 'Comma-separated email addresses to invite (optional)' }
      },
      required: ['title', 'start']
    },
    handler: async ({ title, start, end, location, description, attendees }) => {
      const startDt = new Date(start);
      const endDt = end ? new Date(end) : new Date(startDt.getTime() + 3600000);

      const event = {
        summary: title,
        start: { dateTime: startDt.toISOString() },
        end: { dateTime: endDt.toISOString() }
      };
      if (location) event.location = location;
      if (description) event.description = description;
      if (attendees) {
        event.attendees = attendees.split(',').map(e => ({ email: e.trim() }));
      }

      const res = await getCal().events.insert({ calendarId: 'primary', requestBody: event, sendUpdates: 'all' });
      return `✅ Created: ${formatEvent(res.data)}`;
    }
  },
  {
    name: 'calendar_today',
    description: 'Show today\'s schedule.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 86400000);

      const res = await getCal().events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      if (!res.data.items?.length) return 'Nothing on the calendar today.';
      return res.data.items.map(formatEvent).join('\n\n');
    }
  }
];
