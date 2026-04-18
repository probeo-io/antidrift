import { createClient, fmtRepo } from './client.mjs';

export default {
  description: 'Search GitHub repositories.',
  input: {
    query: { type: 'string', description: 'Search query' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, limit = 20 }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const res = await gh('GET', `/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`);
    if (!res.items?.length) return `No repositories matching "${query}".`;
    return res.items.map(fmtRepo).join('\n');
  }
};
