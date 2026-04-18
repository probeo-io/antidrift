import { createClient } from './client.mjs';

export default {
  description: 'List Cloudflare Pages projects.',
  input: {
    accountId: { type: 'string', description: 'Account ID' }
  },
  execute: async ({ accountId }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/accounts/${accountId}/pages/projects`);
    if (!res.result?.length) return 'No Pages projects found.';
    return res.result.map(p => {
      let line = `${p.name}`;
      if (p.subdomain) line += `  ${p.subdomain}`;
      if (p.source?.type) line += `  [${p.source.type}]`;
      return line;
    }).join('\n');
  }
};
