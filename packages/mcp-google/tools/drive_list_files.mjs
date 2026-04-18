import { createClient } from './client.mjs';

export default {
  description: 'List files in Google Drive. Includes all file types — docs, sheets, PDFs, images, etc. Optional folder or search query.',
  input: {
    query: { type: 'string', description: 'Search query to filter by name', optional: true },
    folderId: { type: 'string', description: 'List files in a specific folder', optional: true },
    mimeType: { type: 'string', description: 'Filter by MIME type (e.g. application/pdf, image/png)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, folderId, mimeType, limit = 20 }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const parts = [];
    if (query) parts.push(`name contains '${query}'`);
    if (folderId) parts.push(`'${folderId}' in parents`);
    if (mimeType) parts.push(`mimeType = '${mimeType}'`);
    const q = parts.length > 0 ? parts.join(' and ') : undefined;

    const res = await (await getDrive()).files.list({
      q, pageSize: limit,
      fields: 'files(id, name, mimeType, modifiedTime)'
    });
    const iconMap = {
      'application/vnd.google-apps.document': '\uD83D\uDCC4',
      'application/vnd.google-apps.spreadsheet': '\uD83D\uDCCA',
      'application/vnd.google-apps.presentation': '\uD83D\uDCFD\uFE0F',
      'application/vnd.google-apps.folder': '\uD83D\uDCC1',
      'application/pdf': '\uD83D\uDCD5',
      'image/png': '\uD83D\uDDBC\uFE0F', 'image/jpeg': '\uD83D\uDDBC\uFE0F', 'image/gif': '\uD83D\uDDBC\uFE0F', 'image/svg+xml': '\uD83D\uDDBC\uFE0F',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '\uD83D\uDCC4',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '\uD83D\uDCCA',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '\uD83D\uDCFD\uFE0F',
      'application/msword': '\uD83D\uDCC4', 'application/vnd.ms-excel': '\uD83D\uDCCA', 'application/vnd.ms-powerpoint': '\uD83D\uDCFD\uFE0F',
    };
    return res.data.files.map(f => `${iconMap[f.mimeType] || '\uD83D\uDCCE'} ${f.name}  [id: ${f.id}]`).join('\n');
  }
};
