import { createClient } from './client.mjs';

export default {
  description: 'List landing pages in HubSpot.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/cms/v3/pages/landing-pages?limit=${limit}`);
    if (!res.results?.length) return 'No landing pages found.';
    return res.results.map(record => {
      let line = `\uD83D\uDCC4 ${record.name || record.title || 'Untitled'}`;
      if (record.state) line += ` \u2014 ${record.state}`;
      line += ` [id: ${record.id}]`;
      return line;
    }).join('\n');
  }
};
