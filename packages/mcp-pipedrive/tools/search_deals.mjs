import { createClient, formatDeal } from './client.mjs';

export default {
  description: 'Search deals by title.',
  input: {
    query: { type: 'string', description: 'Search text' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, limit = 20 }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const res = await pd('GET', `/deals/search?term=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.data?.items?.length) return `No deals matching "${query}".`;
    return res.data.items.map(i => formatDeal(i.item)).join('\n');
  }
};
