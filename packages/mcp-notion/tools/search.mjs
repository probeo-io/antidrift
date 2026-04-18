import { createClient, formatPage, formatDatabase } from './client.mjs';

export default {
  description: 'Search pages and databases in Notion.',
  input: {
    query: { type: 'string', description: 'Search query text', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query = '', limit = 20 }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const body = { page_size: Math.min(limit, 100) };
    if (query) body.query = query;
    const res = await notion('POST', '/search', body);
    if (!res.results?.length) return 'No results found.';
    return res.results.map(item => {
      if (item.object === 'database') return formatDatabase(item);
      return formatPage(item);
    }).join('\n');
  }
};
