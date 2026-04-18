import { createClient, getHeader } from './client.mjs';

export default {
  description: 'Search Gmail messages. Uses Gmail search syntax (from:, to:, subject:, has:attachment, newer_than:, etc.)',
  input: {
    query: { type: 'string', description: 'Gmail search query (e.g. "from:bob subject:invoice newer_than:7d")' },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ query, limit = 10 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getGmail()).users.messages.list({ userId: 'me', q: query, maxResults: limit });
    if (!res.data.messages?.length) return 'No messages found.';

    const messages = await Promise.all(res.data.messages.map(async (m) => {
      const msg = await (await getGmail()).users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
      const headers = msg.data.payload.headers;
      return `\uD83D\uDCE7 ${getHeader(headers, 'Subject')}\n   From: ${getHeader(headers, 'From')}  \u2022  ${getHeader(headers, 'Date')}  [id: ${m.id}]`;
    }));
    return messages.join('\n\n');
  }
};
