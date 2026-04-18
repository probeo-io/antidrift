import { createClient } from './client.mjs';

export default {
  description: 'List forms in HubSpot.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/marketing/v3/forms?limit=${limit}`);
    if (!res.results?.length) return 'No forms found.';
    return res.results.map(record => {
      return `\uD83D\uDCCB ${record.name || 'Untitled'} [id: ${record.id}]`;
    }).join('\n');
  }
};
