import { createClient } from './client.mjs';

export default {
  description: 'List R2 storage buckets.',
  input: {
    accountId: { type: 'string', description: 'Account ID' }
  },
  execute: async ({ accountId }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/accounts/${accountId}/r2/buckets`);
    if (!res.result?.buckets?.length) return 'No R2 buckets found.';
    return res.result.buckets.map(b => {
      let line = `${b.name}`;
      if (b.location) line += `  [${b.location}]`;
      line += `  created: ${new Date(b.creation_date).toLocaleDateString()}`;
      return line;
    }).join('\n');
  }
};
