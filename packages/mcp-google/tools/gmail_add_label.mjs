import { createClient } from './client.mjs';

export default {
  description: 'Add a label to a message.',
  input: {
    messageId: { type: 'string', description: 'The message ID' },
    labelId: { type: 'string', description: 'The label ID (use gmail_list_labels to find)' }
  },
  execute: async ({ messageId, labelId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    await (await getGmail()).users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { addLabelIds: [labelId] }
    });
    return `\u2705 Label added to message ${messageId}`;
  }
};
