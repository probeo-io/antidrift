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
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, parents)'
      });
      return res.data.files;
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
        fields: 'files(id, name, modifiedTime, webViewLink)'
      });
      return res.data.files;
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
    name: 'drive_download_text',
    description: 'Download a file as plain text. Works for Google Docs, PDFs (if text-extractable), and text files.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The file ID' }
      },
      required: ['fileId']
    },
    handler: async ({ fileId }) => {
      // First get the mime type
      const meta = await getDrive().files.get({ fileId, fields: 'mimeType, name' });
      const mime = meta.data.mimeType;

      if (mime === 'application/vnd.google-apps.document') {
        const res = await getDrive().files.export({ fileId, mimeType: 'text/plain' });
        return { name: meta.data.name, content: res.data };
      } else if (mime === 'application/vnd.google-apps.spreadsheet') {
        const res = await getDrive().files.export({ fileId, mimeType: 'text/csv' });
        return { name: meta.data.name, content: res.data };
      } else if (mime === 'text/plain' || mime === 'text/csv' || mime === 'text/markdown') {
        const res = await getDrive().files.get({ fileId, alt: 'media' });
        return { name: meta.data.name, content: res.data };
      } else {
        return { name: meta.data.name, error: `Cannot extract text from ${mime}. Use drive_get_file_info for metadata.` };
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
