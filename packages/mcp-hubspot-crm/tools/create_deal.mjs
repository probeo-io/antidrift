import { createClient } from './client.mjs';

export default {
  description: 'Create a new deal in HubSpot CRM.',
  input: {
    name: { type: 'string', description: 'Deal name' },
    amount: { type: 'string', description: 'Deal amount (optional)', optional: true },
    stage: { type: 'string', description: 'Deal stage (optional)', optional: true },
    pipeline: { type: 'string', description: 'Pipeline (optional, defaults to "default")', optional: true },
    closeDate: { type: 'string', description: 'Close date as ISO string (optional)', optional: true }
  },
  execute: async ({ name, amount, stage, pipeline, closeDate }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const properties = { dealname: name };
    if (amount) properties.amount = amount;
    if (stage) properties.dealstage = stage;
    if (pipeline) properties.pipeline = pipeline;
    if (closeDate) properties.closedate = closeDate;

    const res = await hubspot('POST', '/crm/v3/objects/deals', { properties });
    return `\u2705 Created deal "${name}"  [id: ${res.id}]`;
  }
};
