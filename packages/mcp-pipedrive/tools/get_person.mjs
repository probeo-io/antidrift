import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a contact by ID.',
  input: {
    id: { type: 'number', description: 'Person ID' }
  },
  execute: async ({ id }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const res = await pd('GET', `/persons/${id}`);
    const p = res.data;
    const lines = [];
    lines.push(p.name);
    if (p.email?.length) lines.push(`Email: ${p.email.map(e => e.value).join(', ')}`);
    if (p.phone?.length) lines.push(`Phone: ${p.phone.map(ph => ph.value).join(', ')}`);
    if (p.org_name) lines.push(`Organization: ${p.org_name}`);
    if (p.owner_name) lines.push(`Owner: ${p.owner_name}`);
    lines.push(`Open deals: ${p.open_deals_count || 0}`);
    lines.push(`[id: ${p.id}]`);
    return lines.join('\n');
  }
};
