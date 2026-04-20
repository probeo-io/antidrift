import { createClient, formatCompany } from './client.mjs';

export default {
  description: 'Search for companies in Attio by name or domain.',
  input: {
    query: { type: 'string', description: 'Company name or domain to search for' }
  },
  execute: async ({ query }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/objects/companies/records/query', {
      filter: {
        '$or': [
          { name: { '$contains': query } },
          { domains: { domain: { '$contains': query } } }
        ]
      }
    });
    if (!res.data?.length) return `No companies matching "${query}".`;
    return res.data.map(formatCompany).join('\n');
  }
};
