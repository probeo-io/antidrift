import { createClient, priorityEmoji } from './client.mjs';

export default {
  description: 'Get full details for a ClickUp task, including comments.',
  input: {
    taskId: { type: 'string', description: 'The task ID' }
  },
  execute: async ({ taskId }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const task = await clickup('GET', `/task/${taskId}`);
    const lines = [];
    const prio = task.priority ? parseInt(task.priority.id || task.priority, 10) : null;
    lines.push(`${priorityEmoji(prio)} ${task.name}`);
    lines.push(`Status: ${task.status?.status || 'unknown'}`);
    if (task.description) lines.push(`Description: ${task.description}`);
    if (task.assignees?.length) lines.push(`Assignees: ${task.assignees.map(a => a.username || a.email).join(', ')}`);
    if (task.due_date) lines.push(`Due: ${new Date(parseInt(task.due_date)).toLocaleDateString()}`);
    if (task.tags?.length) lines.push(`Tags: ${task.tags.map(t => t.name).join(', ')}`);
    lines.push(`[id: ${task.id}]`);

    // Fetch comments
    try {
      const commentsRes = await clickup('GET', `/task/${taskId}/comment`);
      const comments = commentsRes.comments || [];
      if (comments.length) {
        lines.push('');
        lines.push('Comments:');
        for (const c of comments) {
          const author = c.user?.username || c.user?.email || 'unknown';
          const text = c.comment_text || '';
          const date = c.date ? new Date(parseInt(c.date)).toLocaleDateString() : '';
          lines.push(`  \ud83d\udcac ${author} (${date}): ${text}`);
        }
      }
    } catch {
      // comments may not be accessible
    }

    return lines.join('\n');
  }
};
