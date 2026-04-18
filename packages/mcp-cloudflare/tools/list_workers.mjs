import { createClient } from './client.mjs';

export default {
  description: 'List Workers scripts.',
  input: {
    accountId: { type: 'string', description: 'Account ID' }
  },
  execute: async ({ accountId }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/accounts/${accountId}/workers/scripts`);
    if (!res.result?.length) return 'No Workers found.';
    return res.result.map(w => {
      let line = `${w.id}`;
      if (w.modified_on) line += `  modified: ${new Date(w.modified_on).toLocaleDateString()}`;
      return line;
    }).join('\n');
  }
};
