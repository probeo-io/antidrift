import { createClient } from './client.mjs';

export default {
  description: 'Mark a message as read.',
  input: {
    messageId: { type: 'string', description: 'The message ID' }
  },
  execute: async ({ messageId }, ctx) => {
    const { getGmail } = createClient(ctx.credentials);
    await (await getGmail()).users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] }
    });
    return `\u2705 Marked as read: ${messageId}`;
  }
};
