import { createClient, formatCompany, COMPANY_PROPERTIES } from './client.mjs';

export default {
  description: 'List companies in HubSpot CRM. Optionally search by query.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true },
    query: { type: 'string', description: 'Search query (optional)', optional: true }
  },
  execute: async ({ limit = 20, query }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    if (query) {
      const res = await hubspot('POST', '/crm/v3/objects/companies/search', {
        query, limit, properties: COMPANY_PROPERTIES
      });
      if (!res.results?.length) return `No companies matching "${query}".`;
      return res.results.map(formatCompany).join('\n');
    }
    const res = await hubspot('GET', `/crm/v3/objects/companies?limit=${limit}&properties=${COMPANY_PROPERTIES.join(',')}`);
    if (!res.results?.length) return 'No companies found.';
    return res.results.map(formatCompany).join('\n');
  }
};
