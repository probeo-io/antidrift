import { createClient } from './client.mjs';

export default {
  description: 'List leads in HubSpot CRM.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/leads?limit=${limit}&properties=firstname,lastname,email,phone,company`);
    if (!res.results?.length) return 'No leads found.';
    return res.results.map(record => {
      const p = record.properties || {};
      const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown';
      const email = p.email || '';
      let line = `\uD83C\uDFAF ${name}`;
      if (email) line += ` \u2014 ${email}`;
      line += ` [id: ${record.id}]`;
      return line;
    }).join('\n');
  }
};
