import { createClient, formatTask } from './client.mjs';

export default {
  description: 'Search tasks across a ClickUp workspace.',
  input: {
    teamId: { type: 'string', description: 'The workspace/team ID' },
    query: { type: 'string', description: 'Search query' }
  },
  execute: async ({ teamId, query }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const res = await clickup('GET', `/team/${teamId}/task?search=${encodeURIComponent(query)}`);
    const tasks = res.tasks || [];
    if (!tasks.length) return `No tasks matching "${query}".`;
    return tasks.map(formatTask).join('\n');
  }
};
