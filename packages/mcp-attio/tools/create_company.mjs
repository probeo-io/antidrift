import { createClient } from './client.mjs';

export default {
  description: 'Create a new company in Attio.',
  input: {
    name: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Website domain (optional)', optional: true }
  },
  execute: async ({ name, domain }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const values = { name: [{ value: name }] };
    if (domain) values.domains = [{ domain }];

    const res = await attio('POST', '/objects/companies/records', { data: { values } });
    return `✅ Created ${name}  [id: ${res.data.id.record_id}]`;
  }
};
