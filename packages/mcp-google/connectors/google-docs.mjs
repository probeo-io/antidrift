import { google } from 'googleapis';
import { getAuthClient } from '../auth-google.mjs';

let docsApi = null;
let driveApi = null;

async function getDocs() {
  if (!docsApi) {
    docsApi = google.docs({ version: 'v1', auth: await getAuthClient() });
  }
  return docsApi;
}

async function getDrive() {
  if (!driveApi) {
    driveApi = google.drive({ version: 'v3', auth: await getAuthClient() });
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
      const doc = await (await getDocs()).documents.create({ requestBody: { title } });
      const docId = doc.data.documentId;

      if (content) {
        await (await getDocs()).documents.batchUpdate({
          documentId: docId,
          requestBody: {
            requests: [{
              insertText: { location: { index: 1 }, text: content }
            }]
          }
        });
      }

      if (folderId) {
        const file = await (await getDrive()).files.get({ fileId: docId, fields: 'parents' });
        await (await getDrive()).files.update({
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
      const doc = await (await getDocs()).documents.get({ documentId });
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
      const doc = await (await getDocs()).documents.get({ documentId });
      const endIndex = doc.data.body.content.at(-1).endIndex - 1;

      await (await getDocs()).documents.batchUpdate({
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
    name: 'write_doc',
    description: 'Write formatted content to a Google Doc. Replaces all existing content. Supports markdown-style formatting: # Heading 1, ## Heading 2, **bold**, _italic_.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The Google Doc ID' },
        content: { type: 'string', description: 'Content with markdown-style formatting (# headings, **bold**, _italic_)' }
      },
      required: ['documentId', 'content']
    },
    handler: async ({ documentId, content }) => {
      // Clear existing content
      const doc = await (await getDocs()).documents.get({ documentId });
      const endIndex = doc.data.body.content.at(-1).endIndex - 1;
      const requests = [];

      if (endIndex > 1) {
        requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
      }

      // Parse markdown-style content into Google Docs requests
      const lines = content.split('\n');
      let insertIndex = 1;
      const bulletRanges = [];
      let prevParaStart = null;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip blank lines — add spacing to previous paragraph instead
        if (line.trim() === '') {
          if (prevParaStart !== null) {
            requests.push({ updateParagraphStyle: {
              range: { startIndex: prevParaStart, endIndex: insertIndex },
              paragraphStyle: { spaceBelow: { magnitude: 8, unit: 'PT' } },
              fields: 'spaceBelow'
            } });
          }
          continue;
        }

        // Skip --- horizontal rules
        if (line.trim() === '---') {
          if (prevParaStart !== null) {
            requests.push({ updateParagraphStyle: {
              range: { startIndex: prevParaStart, endIndex: insertIndex },
              paragraphStyle: { spaceBelow: { magnitude: 16, unit: 'PT' } },
              fields: 'spaceBelow'
            } });
          }
          continue;
        }

        const isBullet = line.startsWith('- ');
        const stripped = isBullet ? line.slice(2) : line;
        const text = stripped + '\n';
        const cleanText = text.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '').replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1');

        prevParaStart = insertIndex;
        requests.push({ insertText: { location: { index: insertIndex }, text: cleanText } });

        // Native bullet list
        if (isBullet) {
          bulletRanges.push({ startIndex: insertIndex, endIndex: insertIndex + cleanText.length });
        }

        // Heading styles
        if (stripped.startsWith('### ')) {
          requests.push({ updateParagraphStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + cleanText.length }, paragraphStyle: { namedStyleType: 'HEADING_3' }, fields: 'namedStyleType' } });
        } else if (stripped.startsWith('## ')) {
          requests.push({ updateParagraphStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + cleanText.length }, paragraphStyle: { namedStyleType: 'HEADING_2' }, fields: 'namedStyleType' } });
        } else if (stripped.startsWith('# ')) {
          requests.push({ updateParagraphStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + cleanText.length }, paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType' } });
        }

        // Apply bold
        const boldRegex = /\*\*([^*]+)\*\*/g;
        let m;
        while ((m = boldRegex.exec(stripped)) !== null) {
          const before = stripped.substring(0, m.index).replace(/\*\*/g, '').replace(/^#{1,3}\s+/, '');
          const start = insertIndex + before.length;
          requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: start + m[1].length }, textStyle: { bold: true }, fields: 'bold' } });
        }

        // Apply italic
        const italicRegex = /(?<!\w)_([^_]+)_(?!\w)/g;
        while ((m = italicRegex.exec(stripped)) !== null) {
          const before = stripped.substring(0, m.index).replace(/\*\*/g, '').replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1').replace(/^#{1,3}\s+/, '');
          const start = insertIndex + before.length;
          requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: start + m[1].length }, textStyle: { italic: true }, fields: 'italic' } });
        }

        insertIndex += cleanText.length;
      }

      // Apply native bullet formatting
      for (const range of bulletRanges) {
        requests.push({ createParagraphBullets: { range, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
      }

      await (await getDocs()).documents.batchUpdate({ documentId, requestBody: { requests } });
      return `✅ Document updated — https://docs.google.com/document/d/${documentId}/edit`;
    }
  },
  {
    name: 'request_signature',
    description: 'Share a Google Doc with someone for e-signature. Shares the doc as a writer and returns the link. The signer opens the doc and uses File → eSignature to sign.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The Google Doc ID' },
        signerEmail: { type: 'string', description: 'Email of the person who needs to sign' },
        message: { type: 'string', description: 'Optional message to include in the sharing notification' }
      },
      required: ['documentId', 'signerEmail']
    },
    handler: async ({ documentId, signerEmail, message }) => {
      await (await getDrive()).permissions.create({
        fileId: documentId,
        requestBody: { type: 'user', role: 'writer', emailAddress: signerEmail },
        emailMessage: message || 'Please review and sign this document using File → eSignature in Google Docs.',
        sendNotificationEmail: true
      });

      const doc = await (await getDocs()).documents.get({ documentId });
      const url = `https://docs.google.com/document/d/${documentId}/edit`;
      return `✅ Shared "${doc.data.title}" with ${signerEmail}\n📝 They'll receive an email with a link to sign.\n🔗 ${url}`;
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

      const res = await (await getDrive()).files.list({
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
      await (await getDrive()).permissions.create({
        fileId: documentId,
        requestBody: { type: 'user', role, emailAddress: email }
      });
      return { shared: email, role, url: `https://docs.google.com/document/d/${documentId}/edit` };
    }
  }
];
