import { createClient, formatOrg } from './client.mjs';

export default {
  description: 'List organizations in Pipedrive.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const res = await pd('GET', `/organizations?limit=${limit}&sort=update_time DESC`);
    if (!res.data?.length) return 'No organizations found.';
    return res.data.map(formatOrg).join('\n');
  }
};
