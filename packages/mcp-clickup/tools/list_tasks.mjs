import { createClient, formatTask } from './client.mjs';

export default {
  description: 'List tasks in a ClickUp list.',
  input: {
    listId: { type: 'string', description: 'The list ID' },
    statuses: { type: 'array', items: { type: 'string' }, description: 'Filter by status names (optional)', optional: true },
    assignees: { type: 'array', items: { type: 'string' }, description: 'Filter by assignee IDs (optional)', optional: true },
    limit: { type: 'number', description: 'Max results (default 50)', optional: true }
  },
  execute: async ({ listId, statuses, assignees, limit = 50 }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    let query = `?page=0`;
    if (statuses?.length) {
      query += statuses.map(s => `&statuses[]=${encodeURIComponent(s)}`).join('');
    }
    if (assignees?.length) {
      query += assignees.map(a => `&assignees[]=${encodeURIComponent(a)}`).join('');
    }
    const res = await clickup('GET', `/list/${listId}/task${query}`);
    const tasks = (res.tasks || []).slice(0, limit);
    if (!tasks.length) return 'No tasks found.';
    return tasks.map(formatTask).join('\n');
  }
};
