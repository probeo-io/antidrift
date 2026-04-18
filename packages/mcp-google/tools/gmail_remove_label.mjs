import { createClient } from './client.mjs';

export default {
  description: 'Remove a label from a message.',
  input: {
    messageId: { type: 'string', description: 'The message ID' },
    labelId: { type: 'string', description: 'The label ID' }
  },
  execute: async ({ messageId, labelId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    await (await getGmail()).users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { removeLabelIds: [labelId] }
    });
    return `\u2705 Label removed from message ${messageId}`;
  }
};
