import { createClient } from './client.mjs';

export default {
  description: 'Move a ClickUp task to a different status.',
  input: {
    taskId: { type: 'string', description: 'The task ID' },
    status: { type: 'string', description: 'The new status name' }
  },
  execute: async ({ taskId, status }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    await clickup('PUT', `/task/${taskId}`, { status });
    return `\u2705 Task ${taskId} moved to "${status}"`;
  }
};
