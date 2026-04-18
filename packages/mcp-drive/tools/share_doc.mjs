import { createClient } from './client.mjs';

export default {
  description: 'Share a Google Doc with someone by email.',
  input: {
    documentId: { type: 'string', description: 'The Google Doc ID' },
    email: { type: 'string', description: 'Email to share with' },
    role: { type: 'string', description: 'Permission role: reader, commenter, or writer (default: writer)', optional: true }
  },
  execute: async ({ documentId, email, role = 'writer' }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    await (await getDrive()).permissions.create({
      fileId: documentId,
      requestBody: { type: 'user', role, emailAddress: email }
    });
    return { shared: email, role, url: `https://docs.google.com/document/d/${documentId}/edit` };
  }
};
