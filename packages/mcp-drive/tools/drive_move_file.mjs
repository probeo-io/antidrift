import { createClient } from './client.mjs';

export default {
  description: 'Move a file to a different folder.',
  input: {
    fileId: { type: 'string', description: 'File ID to move' },
    folderId: { type: 'string', description: 'Destination folder ID' }
  },
  execute: async ({ fileId, folderId }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const file = await (await getDrive()).files.get({ fileId, fields: 'parents, name' });
    const res = await (await getDrive()).files.update({
      fileId,
      addParents: folderId,
      removeParents: file.data.parents.join(','),
      fields: 'id, name, parents'
    });
    return res.data;
  }
};
