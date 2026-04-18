import { createClient } from './client.mjs';

export default {
  description: 'Share a file or folder with someone by email.',
  input: {
    fileId: { type: 'string', description: 'File or folder ID' },
    email: { type: 'string', description: 'Email to share with' },
    role: { type: 'string', description: 'Permission: reader, commenter, or writer (default: reader)', optional: true }
  },
  execute: async ({ fileId, email, role = 'reader' }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    await (await getDrive()).permissions.create({
      fileId,
      requestBody: { type: 'user', role, emailAddress: email }
    });
    const meta = await (await getDrive()).files.get({ fileId, fields: 'name, webViewLink' });
    return { shared: email, role, name: meta.data.name, url: meta.data.webViewLink };
  }
};
