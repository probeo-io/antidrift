import { createClient, formatContact, CONTACT_PROPERTIES } from './client.mjs';

export default {
  description: 'List contacts in HubSpot CRM. Optionally search by query.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true },
    query: { type: 'string', description: 'Search query (optional)', optional: true }
  },
  execute: async ({ limit = 20, query }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    if (query) {
      const res = await hubspot('POST', '/crm/v3/objects/contacts/search', {
        query, limit, properties: CONTACT_PROPERTIES
      });
      if (!res.results?.length) return `No contacts matching "${query}".`;
      return res.results.map(formatContact).join('\n');
    }
    const res = await hubspot('GET', `/crm/v3/objects/contacts?limit=${limit}&properties=${CONTACT_PROPERTIES.join(',')}`);
    if (!res.results?.length) return 'No contacts found.';
    return res.results.map(formatContact).join('\n');
  }
};
