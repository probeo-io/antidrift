import { createClient, formatDatabase } from './client.mjs';

export default {
  description: 'List databases the Notion integration can access.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const res = await notion('POST', '/search', {
      filter: { value: 'database', property: 'object' },
      page_size: Math.min(limit, 100)
    });
    if (!res.results?.length) return 'No databases found.';
    return res.results.map(formatDatabase).join('\n');
  }
};
