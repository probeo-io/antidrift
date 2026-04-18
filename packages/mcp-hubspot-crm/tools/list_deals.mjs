import { createClient, formatDeal, DEAL_PROPERTIES } from './client.mjs';

export default {
  description: 'List deals in HubSpot CRM. Optionally search by query.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true },
    query: { type: 'string', description: 'Search query (optional)', optional: true }
  },
  execute: async ({ limit = 20, query }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    if (query) {
      const res = await hubspot('POST', '/crm/v3/objects/deals/search', {
        query, limit, properties: DEAL_PROPERTIES
      });
      if (!res.results?.length) return `No deals matching "${query}".`;
      return res.results.map(formatDeal).join('\n');
    }
    const res = await hubspot('GET', `/crm/v3/objects/deals?limit=${limit}&properties=${DEAL_PROPERTIES.join(',')}`);
    if (!res.results?.length) return 'No deals found.';
    return res.results.map(formatDeal).join('\n');
  }
};
