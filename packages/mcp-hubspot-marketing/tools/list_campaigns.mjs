import { createClient } from './client.mjs';

export default {
  description: 'List marketing campaigns in HubSpot.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/marketing/v3/campaigns?limit=${limit}`);
    if (!res.results?.length) return 'No campaigns found.';
    return res.results.map(record => {
      const status = record.state || record.status || '';
      let line = `\uD83D\uDCE7 ${record.name || 'Untitled'}`;
      if (status) line += ` \u2014 ${status}`;
      line += ` [id: ${record.id}]`;
      return line;
    }).join('\n');
  }
};
