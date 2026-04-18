import { createClient } from './client.mjs';

export default {
  description: 'Get metadata for a file — name, type, size, location, sharing.',
  input: {
    fileId: { type: 'string', description: 'The file ID' }
  },
  execute: async ({ fileId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getDrive()).files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink, parents, permissions, sharingUser'
    });
    return res.data;
  }
};
