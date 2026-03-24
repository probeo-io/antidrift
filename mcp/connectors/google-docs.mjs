import { google } from 'googleapis';
import { getAuthClient } from '../auth-google.mjs';

let docsApi = null;
let driveApi = null;

function getDocs() {
  if (!docsApi) {
    docsApi = google.docs({ version: 'v1', auth: getAuthClient() });
  }
  return docsApi;
}

function getDrive() {
  if (!driveApi) {
    driveApi = google.drive({ version: 'v3', auth: getAuthClient() });
  }
  return driveApi;
}

export const tools = [
  {
    name: 'create_doc',
    description: 'Create a new Google Doc with optional content and folder placement.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Plain text content to insert' },
        folderId: { type: 'string', description: 'Google Drive folder ID to place the doc in (optional)' }
      },
      required: ['title']
    },
    handler: async ({ title, content, folderId }) => {
      const doc = await getDocs().documents.create({ requestBody: { title } });
      const docId = doc.data.documentId;

      if (content) {
        await getDocs().documents.batchUpdate({
          documentId: docId,
          requestBody: {
            requests: [{
              insertText: { location: { index: 1 }, text: content }
            }]
          }
        });
      }

      if (folderId) {
        const file = await getDrive().files.get({ fileId: docId, fields: 'parents' });
        await getDrive().files.update({
          fileId: docId,
          addParents: folderId,
          removeParents: file.data.parents.join(','),
          fields: 'id, parents'
        });
      }

      return {
        id: docId,
        url: `https://docs.google.com/document/d/${docId}/edit`
      };
    }
  },
  {
    name: 'read_doc',
    description: 'Read the text content of a Google Doc.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The Google Doc ID' }
      },
      required: ['documentId']
    },
    handler: async ({ documentId }) => {
      const doc = await getDocs().documents.get({ documentId });
      const content = doc.data.body.content;
      let text = '';
      for (const el of content) {
        if (el.paragraph) {
          for (const pe of el.paragraph.elements) {
            if (pe.textRun) text += pe.textRun.content;
          }
        }
      }
      return { title: doc.data.title, text };
    }
  },
  {
    name: 'append_to_doc',
    description: 'Append text to the end of a Google Doc.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The Google Doc ID' },
        text: { type: 'string', description: 'Text to append' }
      },
      required: ['documentId', 'text']
    },
    handler: async ({ documentId, text }) => {
      const doc = await getDocs().documents.get({ documentId });
      const endIndex = doc.data.body.content.at(-1).endIndex - 1;

      await getDocs().documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            insertText: { location: { index: endIndex }, text }
          }]
        }
      });

      return { documentId, appended: text.length + ' characters' };
    }
  },
  {
    name: 'list_docs',
    description: 'List Google Docs in Drive. Optional query to filter by name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to filter by name' },
        folderId: { type: 'string', description: 'List docs in a specific folder' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ query, folderId, limit = 20 }) => {
      let q = "mimeType='application/vnd.google-apps.document'";
      if (query) q += ` and name contains '${query}'`;
      if (folderId) q += ` and '${folderId}' in parents`;

      const res = await getDrive().files.list({
        q, pageSize: limit,
        fields: 'files(id, name, modifiedTime, webViewLink)'
      });
      return res.data.files;
    }
  },
  {
    name: 'share_doc',
    description: 'Share a Google Doc with someone by email.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The Google Doc ID' },
        email: { type: 'string', description: 'Email to share with' },
        role: { type: 'string', description: 'Permission role: reader, commenter, or writer (default: writer)' }
      },
      required: ['documentId', 'email']
    },
    handler: async ({ documentId, email, role = 'writer' }) => {
      await getDrive().permissions.create({
        fileId: documentId,
        requestBody: { type: 'user', role, emailAddress: email }
      });
      return { shared: email, role, url: `https://docs.google.com/document/d/${documentId}/edit` };
    }
  }
];
