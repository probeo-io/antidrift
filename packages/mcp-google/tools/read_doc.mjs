import { createClient } from './client.mjs';

export default {
  description: 'Read the text content of a Google Doc.',
  input: {
    documentId: { type: 'string', description: 'The Google Doc ID' }
  },
  execute: async ({ documentId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
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
};
