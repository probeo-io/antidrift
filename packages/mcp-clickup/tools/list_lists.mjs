import { createClient } from './client.mjs';

export default {
  description: 'List lists in a ClickUp folder or space. Provide either folderId or spaceId.',
  input: {
    folderId: { type: 'string', description: 'The folder ID (use this to list lists in a folder)', optional: true },
    spaceId: { type: 'string', description: 'The space ID (use this to list folderless lists in a space)', optional: true }
  },
  execute: async ({ folderId, spaceId }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    let res;
    if (folderId) {
      res = await clickup('GET', `/folder/${folderId}/list`);
    } else if (spaceId) {
      res = await clickup('GET', `/space/${spaceId}/list`);
    } else {
      return 'Provide either folderId or spaceId.';
    }
    const lists = res.lists || [];
    if (!lists.length) return 'No lists found.';
    return lists.map(l => `\ud83d\udcdd ${l.name}  [id: ${l.id}]`).join('\n');
  }
};
