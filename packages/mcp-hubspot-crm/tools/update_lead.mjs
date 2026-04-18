import { createClient } from './client.mjs';

export default {
  description: 'Update a lead in HubSpot CRM.',
  input: {
    leadId: { type: 'string', description: 'The lead ID' },
    properties: { type: 'object', description: 'Properties to update, e.g. {"hs_lead_status": "OPEN"}' }
  },
  execute: async ({ leadId, properties }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('PATCH', `/crm/v3/objects/leads/${leadId}`, { properties });
    return `\u2705 Updated lead ${leadId}`;
  }
};
