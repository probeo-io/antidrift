import { createClient } from './client.mjs';

export default {
  description: 'Update a deal in HubSpot CRM.',
  input: {
    dealId: { type: 'string', description: 'The deal ID' },
    properties: { type: 'object', description: 'Properties to update, e.g. {"amount": "50000", "dealstage": "closedwon"}' }
  },
  execute: async ({ dealId, properties }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties });
    return `\u2705 Updated deal ${dealId}`;
  }
};
