import { createClient } from './client.mjs';

export default {
  description: 'List available statuses for a ClickUp list.',
  input: {
    listId: { type: 'string', description: 'The list ID' }
  },
  execute: async ({ listId }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const res = await clickup('GET', `/list/${listId}`);
    const statuses = res.statuses || [];
    if (!statuses.length) return 'No statuses found.';
    return statuses.map(s => {
      const color = s.color ? ` (${s.color})` : '';
      return `\u25cf ${s.status}${color}  [type: ${s.type || 'custom'}]`;
    }).join('\n');
  }
};
