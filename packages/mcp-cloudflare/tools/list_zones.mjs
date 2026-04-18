import { createClient } from './client.mjs';

export default {
  description: 'List DNS zones (domains) in your Cloudflare account.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/zones?per_page=${limit}`);
    if (!res.result?.length) return 'No zones found.';
    return res.result.map(z => `${z.name}  [${z.status}]  [id: ${z.id}]`).join('\n');
  }
};
