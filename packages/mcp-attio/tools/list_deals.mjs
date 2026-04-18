import { createClient, formatDeal } from './client.mjs';

export default {
  description: 'List deals in Attio CRM.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/objects/deals/records/query', { limit });
    if (!res.data?.length) return 'No deals found.';
    return res.data.map(formatDeal).join('\n');
  }
};
