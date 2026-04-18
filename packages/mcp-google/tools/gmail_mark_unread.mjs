import { createClient } from './client.mjs';

export default {
  description: 'Mark a message as unread.',
  input: {
    messageId: { type: 'string', description: 'The message ID' }
  },
  execute: async ({ messageId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    await (await getGmail()).users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { addLabelIds: ['UNREAD'] }
    });
    return `\u2705 Marked as unread: ${messageId}`;
  }
};
