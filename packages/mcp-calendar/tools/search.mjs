import { createClient, formatEvent } from './client.mjs';

export default {
  description: 'Search calendar events by keyword.',
  input: {
    query: { type: 'string', description: 'Search term' },
    days: { type: 'number', description: 'How many days to search ahead (default 30)', optional: true },
    limit: { type: 'number', description: 'Max events (default 10)', optional: true }
  },
  execute: async ({ query, days = 30, limit = 10 }, ctx) => {
    const { getCal } = createClient(ctx.credentials);
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);

    const res = await (await getCal()).events.list({
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
};
