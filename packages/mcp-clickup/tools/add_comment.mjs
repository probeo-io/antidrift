import { createClient } from './client.mjs';

export default {
  description: 'Add a comment to a ClickUp task.',
  input: {
    taskId: { type: 'string', description: 'The task ID' },
    text: { type: 'string', description: 'Comment text' }
  },
  execute: async ({ taskId, text }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    await clickup('POST', `/task/${taskId}/comment`, { comment_text: text });
    return `\u2705 Comment added to task ${taskId}`;
  }
};
