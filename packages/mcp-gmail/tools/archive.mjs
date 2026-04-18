import { createClient } from './client.mjs';

export default {
  description: 'Archive a message (remove from inbox).',
  input: {
    messageId: { type: 'string', description: 'The message ID' }
  },
  execute: async ({ messageId }, ctx) => {
    const { getGmail } = createClient(ctx.credentials);
    await (await getGmail()).users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { removeLabelIds: ['INBOX'] }
    });
    return `\u2705 Archived message ${messageId}`;
  }
};
