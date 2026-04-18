import { createClient, formatCompany } from './client.mjs';

export default {
  description: 'List companies in Attio CRM.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/objects/companies/records/query', { limit });
    if (!res.data?.length) return 'No companies found.';
    return res.data.map(formatCompany).join('\n');
  }
};
