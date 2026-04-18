import { createClient, CONTACT_PROPERTIES } from './client.mjs';

export default {
  description: 'Get full details for a contact by ID.',
  input: {
    contactId: { type: 'string', description: 'The contact ID' }
  },
  execute: async ({ contactId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/contacts/${contactId}?properties=${CONTACT_PROPERTIES.join(',')}`);
    const p = res.properties || {};
    const lines = [];
    const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown';
    lines.push(`\uD83D\uDC64 ${name}`);
    if (p.email) lines.push(`\uD83D\uDCE7 ${p.email}`);
    if (p.phone) lines.push(`\uD83D\uDCDE ${p.phone}`);
    if (p.company) lines.push(`\uD83C\uDFE2 ${p.company}`);
    if (p.jobtitle) lines.push(`\uD83D\uDCBC ${p.jobtitle}`);
    if (p.lifecyclestage) lines.push(`\uD83D\uDCCA Lifecycle: ${p.lifecyclestage}`);
    lines.push(`[id: ${contactId}]`);
    return lines.join('\n');
  }
};
