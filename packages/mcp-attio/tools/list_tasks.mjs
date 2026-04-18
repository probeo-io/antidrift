import { createClient } from './client.mjs';

export default {
  description: 'List tasks in Attio.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('GET', `/tasks?limit=${limit}`);
    if (!res.data?.length) return 'No tasks found.';
    return res.data.map(t => {
      const status = t.is_completed ? '✅' : '⬜';
      const content = t.content_plaintext || 'No description';
      const deadline = t.deadline_at ? ` (due: ${new Date(t.deadline_at).toLocaleDateString()})` : '';
      return `${status} ${content}${deadline}  [id: ${t.id.task_id}]`;
    }).join('\n');
  }
};
