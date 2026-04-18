import { createClient } from './client.mjs';

export default {
  description: 'Create a new Gmail label.',
  input: {
    name: { type: 'string', description: 'Label name' }
  },
  execute: async ({ name }, ctx) => {
    const { getGmail } = createClient(ctx.credentials);
    const res = await (await getGmail()).users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }
    });
    return `\u2705 Label created: "${name}"  [id: ${res.data.id}]`;
  }
};
