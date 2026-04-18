import { createClient, formatPerson } from './client.mjs';

export default {
  description: 'Search contacts by name, email, or phone.',
  input: {
    query: { type: 'string', description: 'Search text' }
  },
  execute: async ({ query }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const res = await pd('GET', `/persons/search?term=${encodeURIComponent(query)}`);
    if (!res.data?.items?.length) return `No contacts matching "${query}".`;
    return res.data.items.map(i => formatPerson(i.item)).join('\n');
  }
};
