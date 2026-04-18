import { createClient } from './client.mjs';

export default {
  description: 'List line items in HubSpot CRM.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/line_items?limit=${limit}&properties=name,quantity,price,amount`);
    if (!res.results?.length) return 'No line items found.';
    return res.results.map(record => {
      const p = record.properties || {};
      let line = p.name || 'Unknown';
      if (p.quantity) line += ` \u00D7${p.quantity}`;
      if (p.price) line += ` @ $${p.price}`;
      if (p.amount) line += ` = $${p.amount}`;
      line += ` [id: ${record.id}]`;
      return line;
    }).join('\n');
  }
};
