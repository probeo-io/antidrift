import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a marketing campaign by ID.',
  input: {
    campaignId: { type: 'string', description: 'The campaign ID' }
  },
  execute: async ({ campaignId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/marketing/v3/campaigns/${campaignId}`);
    const lines = [];
    lines.push(`\uD83D\uDCE7 ${res.name || 'Untitled'}`);
    for (const [key, value] of Object.entries(res)) {
      if (key === 'name' || key === 'id') continue;
      if (value != null && value !== '' && typeof value !== 'object') {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push(`[id: ${campaignId}]`);
    return lines.join('\n');
  }
};
