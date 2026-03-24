import { google } from 'googleapis';
import { getAuthClient } from '../auth-google.mjs';

let driveApi = null;

function getDrive() {
  if (!driveApi) {
    driveApi = google.drive({ version: 'v3', auth: getAuthClient() });
  }
  return driveApi;
}

export const tools = [
  {
    name: 'drive_list_files',
    description: 'List files in Google Drive. Includes all file types — docs, sheets, PDFs, images, etc. Optional folder or search query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to filter by name' },
        folderId: { type: 'string', description: 'List files in a specific folder' },
        mimeType: { type: 'string', description: 'Filter by MIME type (e.g. application/pdf, image/png)' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ query, folderId, mimeType, limit = 20 }) => {
      const parts = [];
      if (query) parts.push(`name contains '${query}'`);
      if (folderId) parts.push(`'${folderId}' in parents`);
      if (mimeType) parts.push(`mimeType = '${mimeType}'`);
      const q = parts.length > 0 ? parts.join(' and ') : undefined;

      const res = await getDrive().files.list({
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
  },
  {
    name: 'drive_list_folders',
    description: 'List folders in Google Drive. Optional parent folder or search query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to filter by name' },
        parentId: { type: 'string', description: 'List subfolders of a specific folder' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ query, parentId, limit = 20 }) => {
      const parts = ["mimeType = 'application/vnd.google-apps.folder'"];
      if (query) parts.push(`name contains '${query}'`);
      if (parentId) parts.push(`'${parentId}' in parents`);

      const res = await getDrive().files.list({
        q: parts.join(' and '), pageSize: limit,
        fields: 'files(id, name)'
      });
      return res.data.files.map(f => `📁 ${f.name}  [id: ${f.id}]`).join('\n');
    }
  },
  {
    name: 'drive_get_file_info',
    description: 'Get metadata for a file — name, type, size, location, sharing.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The file ID' }
      },
      required: ['fileId']
    },
    handler: async ({ fileId }) => {
      const res = await getDrive().files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, webViewLink, parents, permissions, sharingUser'
      });
      return res.data;
    }
  },
  {
    name: 'drive_download',
    description: 'Download a file from Google Drive. For Google-native files (Docs, Sheets, Slides), exports to the requested format. For uploaded files (PDF, DOCX, XLSX, PPTX, etc.), downloads as-is or converts. Saves to a local path.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The file ID' },
        outputPath: { type: 'string', description: 'Local path to save the file (e.g. ./downloads/report.pdf)' },
        format: { type: 'string', description: 'Export format: pdf, docx, xlsx, pptx, csv, txt, html. Only needed for Google-native files. Uploaded files download in their original format by default.' }
      },
      required: ['fileId', 'outputPath']
    },
    handler: async ({ fileId, outputPath, format }) => {
      const { writeFileSync, mkdirSync } = await import('fs');
      const { dirname } = await import('path');

      const meta = await getDrive().files.get({ fileId, fields: 'mimeType, name' });
      const mime = meta.data.mimeType;

      const googleExportMap = {
        'application/vnd.google-apps.document': {
          pdf: 'application/pdf',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          txt: 'text/plain',
          html: 'text/html'
        },
        'application/vnd.google-apps.spreadsheet': {
          pdf: 'application/pdf',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv: 'text/csv'
        },
        'application/vnd.google-apps.presentation': {
          pdf: 'application/pdf',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        }
      };

      mkdirSync(dirname(outputPath), { recursive: true });

      const isGoogleNative = mime in googleExportMap;

      if (isGoogleNative) {
        const exportFormats = googleExportMap[mime];
        const exportFormat = format || Object.keys(exportFormats)[0];
        const exportMime = exportFormats[exportFormat];

        if (!exportMime) {
          return { error: `Cannot export ${mime} as ${format}. Supported: ${Object.keys(exportFormats).join(', ')}` };
        }

        const res = await getDrive().files.export(
          { fileId, mimeType: exportMime },
          { responseType: 'arraybuffer' }
        );
        writeFileSync(outputPath, Buffer.from(res.data));
        return { name: meta.data.name, format: exportFormat, savedTo: outputPath };
      } else {
        const res = await getDrive().files.get(
          { fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        writeFileSync(outputPath, Buffer.from(res.data));
        return { name: meta.data.name, mimeType: mime, savedTo: outputPath };
      }
    }
  },
  {
    name: 'drive_share',
    description: 'Share a file or folder with someone by email.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File or folder ID' },
        email: { type: 'string', description: 'Email to share with' },
        role: { type: 'string', description: 'Permission: reader, commenter, or writer (default: reader)' }
      },
      required: ['fileId', 'email']
    },
    handler: async ({ fileId, email, role = 'reader' }) => {
      await getDrive().permissions.create({
        fileId,
        requestBody: { type: 'user', role, emailAddress: email }
      });
      const meta = await getDrive().files.get({ fileId, fields: 'name, webViewLink' });
      return { shared: email, role, name: meta.data.name, url: meta.data.webViewLink };
    }
  },
  {
    name: 'drive_create_folder',
    description: 'Create a folder in Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
        parentId: { type: 'string', description: 'Parent folder ID (optional)' }
      },
      required: ['name']
    },
    handler: async ({ name, parentId }) => {
      const metadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      };
      if (parentId) metadata.parents = [parentId];

      const res = await getDrive().files.create({
        requestBody: metadata,
        fields: 'id, name, webViewLink'
      });
      return res.data;
    }
  },
  {
    name: 'drive_move_file',
    description: 'Move a file to a different folder.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID to move' },
        folderId: { type: 'string', description: 'Destination folder ID' }
      },
      required: ['fileId', 'folderId']
    },
    handler: async ({ fileId, folderId }) => {
      const file = await getDrive().files.get({ fileId, fields: 'parents, name' });
      const res = await getDrive().files.update({
        fileId,
        addParents: folderId,
        removeParents: file.data.parents.join(','),
        fields: 'id, name, parents'
      });
      return res.data;
    }
  }
];
