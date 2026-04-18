import { createClient, formatEvent } from './client.mjs';

export default {
  description: 'Show upcoming calendar events. Defaults to the next 7 days.',
  input: {
    days: { type: 'number', description: 'Number of days to look ahead (default 7)', optional: true },
    limit: { type: 'number', description: 'Max events (default 20)', optional: true }
  },
  execute: async ({ days = 7, limit = 20 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);

    const res = await (await getCal()).events.list({
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
};
