import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a person by record ID.',
  input: {
    recordId: { type: 'string', description: 'The person record ID' }
  },
  execute: async ({ recordId }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('GET', `/objects/people/records/${recordId}`);
    const vals = res.data.values || {};
    const lines = [];
    const name = vals.name?.[0]?.full_name || 'Unknown';
    lines.push(`👤 ${name}`);
    if (vals.email_addresses?.length) lines.push(`📧 ${vals.email_addresses.map(e => e.email_address).join(', ')}`);
    if (vals.phone_numbers?.length) lines.push(`📞 ${vals.phone_numbers.map(p => p.phone_number).join(', ')}`);
    if (vals.job_title?.[0]?.value) lines.push(`💼 ${vals.job_title[0].value}`);
    if (vals.description?.[0]?.value) lines.push(`📝 ${vals.description[0].value}`);
    lines.push(`[id: ${recordId}]`);
    return lines.join('\n');
  }
};
