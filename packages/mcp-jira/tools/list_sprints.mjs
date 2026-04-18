import { createClient } from './client.mjs';

export default {
  description: 'List sprints for a Jira board.',
  input: {
    boardId: { type: 'string', description: 'The board ID' }
  },
  execute: async ({ boardId }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const res = await jira('GET', `/rest/agile/1.0/board/${boardId}/sprint`);
    const sprints = res.values || [];
    if (!sprints.length) return 'No sprints found.';
    return sprints.map(s => {
      const start = s.startDate || '?';
      const end = s.endDate || '?';
      return `\uD83C\uDFC3 ${s.name} \u2014 ${s.state} (${start} - ${end})`;
    }).join('\n');
  }
};
