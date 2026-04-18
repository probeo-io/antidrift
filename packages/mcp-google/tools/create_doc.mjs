import { createClient } from './client.mjs';

export default {
  description: 'Create a new Google Doc with optional content and folder placement.',
  input: {
    title: { type: 'string', description: 'Document title' },
    content: { type: 'string', description: 'Plain text content to insert', optional: true },
    folderId: { type: 'string', description: 'Google Drive folder ID to place the doc in (optional)', optional: true }
  },
  execute: async ({ title, content, folderId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
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
};
