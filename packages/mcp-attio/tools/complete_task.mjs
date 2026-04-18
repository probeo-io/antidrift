import { createClient } from './client.mjs';

export default {
  description: 'Mark a task as completed in Attio.',
  input: {
    taskId: { type: 'string', description: 'The task ID to complete' }
  },
  execute: async ({ taskId }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('PATCH', `/tasks/${taskId}`, { data: { is_completed: true } });
    return `✅ Task marked as completed`;
  }
};
