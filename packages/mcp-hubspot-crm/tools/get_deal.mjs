import { createClient, DEAL_PROPERTIES } from './client.mjs';

export default {
  description: 'Get full details for a deal by ID.',
  input: {
    dealId: { type: 'string', description: 'The deal ID' }
  },
  execute: async ({ dealId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPERTIES.join(',')}`);
    const p = res.properties || {};
    const lines = [];
    lines.push(`\uD83D\uDCB0 ${p.dealname || 'Unknown'}`);
    if (p.dealstage) lines.push(`\uD83D\uDCCA Stage: ${p.dealstage}`);
    if (p.pipeline) lines.push(`\uD83D\uDEE4\uFE0F Pipeline: ${p.pipeline}`);
    if (p.amount) lines.push(`\uD83D\uDCB5 $${p.amount}`);
    if (p.closedate) lines.push(`\uD83D\uDCC5 Close: ${p.closedate}`);
    lines.push(`[id: ${dealId}]`);
    return lines.join('\n');
  }
};
