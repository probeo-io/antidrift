import { createClient } from './client.mjs';

export default {
  description: 'Delete an R2 storage bucket (must be empty).',
  input: {
    accountId: { type: 'string', description: 'Account ID' },
    name: { type: 'string', description: 'Bucket name' }
  },
  execute: async ({ accountId, name }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    await cf('DELETE', `/accounts/${accountId}/r2/buckets/${name}`);
    return `Deleted R2 bucket: ${name}`;
  }
};
