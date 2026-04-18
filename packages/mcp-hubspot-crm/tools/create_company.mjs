import { createClient } from './client.mjs';

export default {
  description: 'Create a new company in HubSpot CRM.',
  input: {
    name: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Website domain (optional)', optional: true },
    industry: { type: 'string', description: 'Industry (optional)', optional: true }
  },
  execute: async ({ name, domain, industry }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const properties = { name };
    if (domain) properties.domain = domain;
    if (industry) properties.industry = industry;

    const res = await hubspot('POST', '/crm/v3/objects/companies', { properties });
    return `\u2705 Created ${name}  [id: ${res.id}]`;
  }
};
