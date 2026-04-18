import { createClient } from './client.mjs';

export default {
  description: 'List workspace users in Notion.',
  input: {},
  execute: async (_args, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const res = await notion('GET', '/users');
    if (!res.results?.length) return 'No users found.';
    return res.results.map(user => {
      const type = user.type === 'bot' ? '\uD83E\uDD16' : '\uD83D\uDC64';
      return `${type} ${user.name || 'Unknown'} (${user.type}) [id: ${user.id}]`;
    }).join('\n');
  }
};
