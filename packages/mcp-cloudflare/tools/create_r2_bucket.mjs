import { createClient } from './client.mjs';

export default {
  description: 'Create an R2 storage bucket.',
  input: {
    accountId: { type: 'string', description: 'Account ID' },
    name: { type: 'string', description: 'Bucket name' },
    location: { type: 'string', description: 'Location hint (e.g. "wnam", "enam", "weur", "eeur", "apac")', optional: true }
  },
  execute: async ({ accountId, name, location }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const body = { name };
    if (location) body.locationHint = location;
    await cf('POST', `/accounts/${accountId}/r2/buckets`, body);
    return `Created R2 bucket: ${name}`;
  }
};
