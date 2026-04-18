import { createClient, formatContact, formatCompany, formatDeal, searchPropertiesForType } from './client.mjs';

export default {
  description: 'Search across contacts, companies, or deals in HubSpot CRM.',
  input: {
    objectType: { type: 'string', description: 'Object type: "contacts", "companies", or "deals"' },
    query: { type: 'string', description: 'Search query' },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ objectType, query, limit = 10 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const properties = searchPropertiesForType(objectType);
    const res = await hubspot('POST', `/crm/v3/objects/${objectType}/search`, {
      query, limit, properties
    });

    if (!res.results?.length) return `No ${objectType} matching "${query}".`;

    const formatter = objectType === 'contacts' ? formatContact
      : objectType === 'companies' ? formatCompany
      : formatDeal;

    return res.results.map(formatter).join('\n');
  }
};
