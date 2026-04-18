import { createClient } from './client.mjs';

export default {
  description: 'Update a contact in HubSpot CRM.',
  input: {
    contactId: { type: 'string', description: 'The contact ID' },
    properties: { type: 'object', description: 'Properties to update, e.g. {"firstname": "Jane", "phone": "555-1234"}' }
  },
  execute: async ({ contactId, properties }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties });
    return `\u2705 Updated contact ${contactId}`;
  }
};
