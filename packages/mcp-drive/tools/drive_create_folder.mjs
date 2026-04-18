import { createClient } from './client.mjs';

export default {
  description: 'Create a folder in Google Drive.',
  input: {
    name: { type: 'string', description: 'Folder name' },
    parentId: { type: 'string', description: 'Parent folder ID (optional)', optional: true }
  },
  execute: async ({ name, parentId }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) metadata.parents = [parentId];

    const res = await (await getDrive()).files.create({
      requestBody: metadata,
      fields: 'id, name, webViewLink'
    });
    return res.data;
  }
};
