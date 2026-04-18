import { createClient, formatEvent } from './client.mjs';

export default {
  description: 'Create a calendar event.',
  input: {
    title: { type: 'string', description: 'Event title' },
    start: { type: 'string', description: 'Start time (ISO 8601 or natural like "2026-03-25T10:00:00")' },
    end: { type: 'string', description: 'End time (ISO 8601). If omitted, defaults to 1 hour after start.', optional: true },
    location: { type: 'string', description: 'Location (optional)', optional: true },
    description: { type: 'string', description: 'Event description (optional)', optional: true },
    attendees: { type: 'string', description: 'Comma-separated email addresses to invite (optional)', optional: true }
  },
  execute: async ({ title, start, end, location, description, attendees }, ctx) => {
    const { getCal } = createClient(ctx.credentials);
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

    const res = await (await getCal()).events.insert({ calendarId: 'primary', requestBody: event, sendUpdates: 'all' });
    return `✅ Created: ${formatEvent(res.data)}`;
  }
};
