import { createClient, formatPerson } from './client.mjs';

export default {
  description: 'Search for people in Attio by name or email.',
  input: {
    query: { type: 'string', description: 'Name or email to search for' }
  },
  execute: async ({ query }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/objects/people/records/query', {
      filter: {
        or: [
          { attribute: 'name', condition: 'contains', value: query },
          { attribute: 'email_addresses', condition: 'contains', value: query }
        ]
      }
    });
    if (!res.data?.length) return `No people matching "${query}".`;
    return res.data.map(formatPerson).join('\n');
  }
};
