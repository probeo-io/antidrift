import { createClient } from './client.mjs';

export default {
  description: 'Get metadata for a Worker script.',
  input: {
    accountId: { type: 'string', description: 'Account ID' },
    scriptName: { type: 'string', description: 'Worker script name' }
  },
  execute: async ({ accountId, scriptName }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/accounts/${accountId}/workers/scripts/${scriptName}/settings`);
    const s = res.result;
    const lines = [`${scriptName}`];
    if (s.bindings?.length) {
      lines.push(`Bindings: ${s.bindings.map(b => `${b.name} (${b.type})`).join(', ')}`);
    }
    if (s.compatibility_date) lines.push(`Compat date: ${s.compatibility_date}`);
    return lines.join('\n');
  }
};
