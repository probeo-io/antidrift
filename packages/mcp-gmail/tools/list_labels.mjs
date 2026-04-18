import { createClient } from './client.mjs';

export default {
  description: 'List all Gmail labels.',
  input: {},
  execute: async (_args, ctx) => {
    const { getGmail } = createClient(ctx.credentials);
    const res = await (await getGmail()).users.labels.list({ userId: 'me' });
    if (!res.data.labels?.length) return 'No labels found.';
    return res.data.labels.map(l => `\uD83C\uDFF7\uFE0F ${l.name}  [id: ${l.id}]`).join('\n');
  }
};
