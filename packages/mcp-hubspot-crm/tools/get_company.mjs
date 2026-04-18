import { createClient, COMPANY_PROPERTIES } from './client.mjs';

export default {
  description: 'Get full details for a company by ID.',
  input: {
    companyId: { type: 'string', description: 'The company ID' }
  },
  execute: async ({ companyId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/crm/v3/objects/companies/${companyId}?properties=${COMPANY_PROPERTIES.join(',')}`);
    const p = res.properties || {};
    const lines = [];
    lines.push(`\uD83C\uDFE2 ${p.name || 'Unknown'}`);
    if (p.domain) lines.push(`\uD83C\uDF10 ${p.domain}`);
    if (p.industry) lines.push(`\uD83C\uDFED ${p.industry}`);
    if (p.numberofemployees) lines.push(`\uD83D\uDC65 ${p.numberofemployees} employees`);
    if (p.annualrevenue) lines.push(`\uD83D\uDCB5 $${p.annualrevenue} annual revenue`);
    lines.push(`[id: ${companyId}]`);
    return lines.join('\n');
  }
};
