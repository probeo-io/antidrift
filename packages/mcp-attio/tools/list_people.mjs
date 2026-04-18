import { createClient, formatPerson } from './client.mjs';

export default {
  description: 'List people in Attio CRM.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/objects/people/records/query', { limit });
    if (!res.data?.length) return 'No people found.';
    return res.data.map(formatPerson).join('\n');
  }
};
