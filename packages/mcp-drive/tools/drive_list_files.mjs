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
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
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
      'application/vnd.google-apps.document': '📄',
      'application/vnd.google-apps.spreadsheet': '📊',
      'application/vnd.google-apps.presentation': '📽️',
      'application/vnd.google-apps.folder': '📁',
      'application/pdf': '📕',
      'image/png': '🖼️', 'image/jpeg': '🖼️', 'image/gif': '🖼️', 'image/svg+xml': '🖼️',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📄',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📽️',
      'application/msword': '📄', 'application/vnd.ms-excel': '📊', 'application/vnd.ms-powerpoint': '📽️',
    };
    return res.data.files.map(f => `${iconMap[f.mimeType] || '📎'} ${f.name}  [id: ${f.id}]`).join('\n');
  }
};
