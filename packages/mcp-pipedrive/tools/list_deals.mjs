import { createClient, formatDeal } from './client.mjs';

export default {
  description: 'List deals in Pipedrive with optional status filter.',
  input: {
    status: { type: 'string', description: 'Filter by status: open, won, lost, deleted (default: open)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ status = 'open', limit = 20 }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const res = await pd('GET', `/deals?status=${status}&limit=${limit}&sort=update_time DESC`);
    if (!res.data?.length) return 'No deals found.';
    return res.data.map(formatDeal).join('\n');
  }
};
