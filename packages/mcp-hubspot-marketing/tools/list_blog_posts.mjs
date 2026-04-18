import { createClient } from './client.mjs';

export default {
  description: 'List blog posts in HubSpot.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/cms/v3/blogs/posts?limit=${limit}`);
    if (!res.results?.length) return 'No blog posts found.';
    return res.results.map(record => {
      let line = `\uD83D\uDCDD ${record.name || record.title || 'Untitled'}`;
      if (record.state) line += ` \u2014 ${record.state}`;
      if (record.publishDate) line += `, ${record.publishDate}`;
      line += ` [id: ${record.id}]`;
      return line;
    }).join('\n');
  }
};
