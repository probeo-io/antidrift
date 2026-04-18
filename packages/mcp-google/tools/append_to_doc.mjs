import { createClient } from './client.mjs';

export default {
  description: 'Append text to the end of a Google Doc.',
  input: {
    documentId: { type: 'string', description: 'The Google Doc ID' },
    text: { type: 'string', description: 'Text to append' }
  },
  execute: async ({ documentId, text }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
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
};
