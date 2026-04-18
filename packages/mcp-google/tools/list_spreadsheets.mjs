import { createClient } from './client.mjs';

export default {
  description: 'List Google Sheets in your Drive. Optional query to filter by name.',
  input: {
    query: { type: 'string', description: 'Search query to filter by name', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, limit = 20 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const q = query
      ? `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${query}'`
      : `mimeType='application/vnd.google-apps.spreadsheet'`;
    const res = await (await getDrive()).files.list({
      q, pageSize: limit,
      fields: 'files(id, name, modifiedTime, webViewLink)'
    });
    return res.data.files;
  }
};
