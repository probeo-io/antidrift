import { createClient } from './client.mjs';

export default {
  description: 'Update a company in HubSpot CRM.',
  input: {
    companyId: { type: 'string', description: 'The company ID' },
    properties: { type: 'object', description: 'Properties to update, e.g. {"industry": "Technology"}' }
  },
  execute: async ({ companyId, properties }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('PATCH', `/crm/v3/objects/companies/${companyId}`, { properties });
    return `\u2705 Updated company ${companyId}`;
  }
};
