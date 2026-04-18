import { createClient } from './client.mjs';

export default {
  description: 'List folders in Google Drive. Optional parent folder or search query.',
  input: {
    query: { type: 'string', description: 'Search query to filter by name', optional: true },
    parentId: { type: 'string', description: 'List subfolders of a specific folder', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, parentId, limit = 20 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const parts = ["mimeType = 'application/vnd.google-apps.folder'"];
    if (query) parts.push(`name contains '${query}'`);
    if (parentId) parts.push(`'${parentId}' in parents`);

    const res = await (await getDrive()).files.list({
      q: parts.join(' and '), pageSize: limit,
      fields: 'files(id, name)'
    });
    return res.data.files.map(f => `\uD83D\uDCC1 ${f.name}  [id: ${f.id}]`).join('\n');
  }
};
