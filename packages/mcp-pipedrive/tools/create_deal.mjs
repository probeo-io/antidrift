import { createClient } from './client.mjs';

export default {
  description: 'Create a new deal in Pipedrive.',
  input: {
    title: { type: 'string', description: 'Deal title' },
    value: { type: 'number', description: 'Deal value', optional: true },
    currency: { type: 'string', description: 'Currency code (default: USD)', optional: true },
    personId: { type: 'number', description: 'Contact person ID', optional: true },
    orgId: { type: 'number', description: 'Organization ID', optional: true }
  },
  execute: async ({ title, value, currency, personId, orgId }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const body = { title };
    if (value) body.value = value;
    if (currency) body.currency = currency;
    if (personId) body.person_id = personId;
    if (orgId) body.org_id = orgId;
    const res = await pd('POST', '/deals', body);
    return `Created deal: ${res.data.title}  [id: ${res.data.id}]`;
  }
};
