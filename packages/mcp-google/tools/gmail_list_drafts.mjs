import { createClient, getHeader } from './client.mjs';

export default {
  description: 'List Gmail drafts.',
  input: {
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ limit = 10 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getGmail()).users.drafts.list({ userId: 'me', maxResults: limit });
    if (!res.data.drafts?.length) return 'No drafts found.';
    const drafts = await Promise.all(res.data.drafts.map(async (d) => {
      const draft = await (await getGmail()).users.drafts.get({ userId: 'me', id: d.id, format: 'metadata' });
      const headers = draft.data.message.payload.headers;
      return `\uD83D\uDCDD ${getHeader(headers, 'Subject') || '(no subject)'}\n   To: ${getHeader(headers, 'To') || '(no recipient)'}  [id: ${d.id}]`;
    }));
    return drafts.join('\n\n');
  }
};
