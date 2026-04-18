import { createClient } from './client.mjs';

export default {
  description: 'Create a new contact in Pipedrive.',
  input: {
    name: { type: 'string', description: 'Contact name' },
    email: { type: 'string', description: 'Email address', optional: true },
    phone: { type: 'string', description: 'Phone number', optional: true },
    orgId: { type: 'number', description: 'Organization ID to link to', optional: true }
  },
  execute: async ({ name, email, phone, orgId }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const body = { name };
    if (email) body.email = [{ value: email, primary: true }];
    if (phone) body.phone = [{ value: phone, primary: true }];
    if (orgId) body.org_id = orgId;
    const res = await pd('POST', '/persons', body);
    return `Created contact: ${res.data.name}  [id: ${res.data.id}]`;
  }
};
