import { createClient } from './client.mjs';

export default {
  description: 'List spaces in a ClickUp workspace.',
  input: {
    teamId: { type: 'string', description: 'The workspace/team ID' }
  },
  execute: async ({ teamId }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const res = await clickup('GET', `/team/${teamId}/space`);
    const spaces = res.spaces || [];
    if (!spaces.length) return 'No spaces found.';
    return spaces.map(s => `\ud83d\udcc1 ${s.name}  [id: ${s.id}]`).join('\n');
  }
};
