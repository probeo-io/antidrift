import { createClient, formatDeal } from './client.mjs';

export default {
  description: 'Search for deals in Attio by name or stage.',
  input: {
    query: { type: 'string', description: 'Deal name or stage to search for' }
  },
  execute: async ({ query }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/objects/deals/records/query', {
      filter: {
        '$or': [
          { name: { '$contains': query } },
          { stage: { status: { '$contains': query } } }
        ]
      }
    });
    if (!res.data?.length) return `No deals matching "${query}".`;
    return res.data.map(formatDeal).join('\n');
  }
};
