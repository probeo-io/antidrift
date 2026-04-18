import { createClient } from './client.mjs';

export default {
  description: 'List Google Docs in Drive. Optional query to filter by name.',
  input: {
    query: { type: 'string', description: 'Search query to filter by name', optional: true },
    folderId: { type: 'string', description: 'List docs in a specific folder', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, folderId, limit = 20 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    let q = "mimeType='application/vnd.google-apps.document'";
    if (query) q += ` and name contains '${query}'`;
    if (folderId) q += ` and '${folderId}' in parents`;

    const res = await (await getDrive()).files.list({
      q, pageSize: limit,
      fields: 'files(id, name, modifiedTime, webViewLink)'
    });
    return res.data.files;
  }
};
