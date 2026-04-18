import { createClient } from './client.mjs';

export default {
  description: 'Move a message to trash.',
  input: {
    messageId: { type: 'string', description: 'The message ID' }
  },
  execute: async ({ messageId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    await (await getGmail()).users.messages.trash({ userId: 'me', id: messageId });
    return `\u2705 Trashed message ${messageId}`;
  }
};
