import { createClient } from './client.mjs';

export default {
  description: 'List forecasts in HubSpot CRM.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/forecasts?limit=${limit}`);
    if (!res.results?.length) return 'No forecasts found.';
    return res.results.map(record => {
      const p = record.properties || {};
      const lines = [`Forecast [id: ${record.id}]`];
      for (const [key, value] of Object.entries(p)) {
        if (value != null && value !== '') lines.push(`  ${key}: ${value}`);
      }
      return lines.join('\n');
    }).join('\n\n');
  }
};
