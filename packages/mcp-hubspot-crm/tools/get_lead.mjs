import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a lead by ID.',
  input: {
    leadId: { type: 'string', description: 'The lead ID' }
  },
  execute: async ({ leadId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/leads/${leadId}?properties=firstname,lastname,email,phone,company,lifecyclestage,hs_lead_status`);
    const p = res.properties || {};
    const lines = [];
    const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown';
    lines.push(`\uD83C\uDFAF ${name}`);
    if (p.email) lines.push(`\uD83D\uDCE7 ${p.email}`);
    if (p.phone) lines.push(`\uD83D\uDCDE ${p.phone}`);
    if (p.company) lines.push(`\uD83C\uDFE2 ${p.company}`);
    if (p.lifecyclestage) lines.push(`\uD83D\uDCCA Lifecycle: ${p.lifecyclestage}`);
    if (p.hs_lead_status) lines.push(`\uD83D\uDCCC Status: ${p.hs_lead_status}`);
    lines.push(`[id: ${leadId}]`);
    return lines.join('\n');
  }
};
