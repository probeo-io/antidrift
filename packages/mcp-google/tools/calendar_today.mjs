import { createClient, formatEvent } from './client.mjs';

export default {
  description: "Show today's schedule.",
  input: {},
  execute: async (_args, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const res = await (await getCal()).events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    if (!res.data.items?.length) return 'Nothing on the calendar today.';
    return res.data.items.map(formatEvent).join('\n\n');
  }
};
