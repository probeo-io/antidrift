import { createClient } from './client.mjs';

export default {
  description: 'Create a new organization in Pipedrive.',
  input: {
    name: { type: 'string', description: 'Organization name' },
    address: { type: 'string', description: 'Address (optional)', optional: true }
  },
  execute: async ({ name, address }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const body = { name };
    if (address) body.address = address;
    const res = await pd('POST', '/organizations', body);
    return `Created organization: ${res.data.name}  [id: ${res.data.id}]`;
  }
};
