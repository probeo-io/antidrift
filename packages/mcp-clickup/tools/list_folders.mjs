import { createClient } from './client.mjs';

export default {
  description: 'List folders in a ClickUp space.',
  input: {
    spaceId: { type: 'string', description: 'The space ID' }
  },
  execute: async ({ spaceId }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const res = await clickup('GET', `/space/${spaceId}/folder`);
    const folders = res.folders || [];
    if (!folders.length) return 'No folders found.';
    return folders.map(f => `\ud83d\udcc2 ${f.name}  [id: ${f.id}]`).join('\n');
  }
};
