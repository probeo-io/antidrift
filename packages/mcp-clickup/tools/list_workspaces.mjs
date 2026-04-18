import { createClient } from './client.mjs';

export default {
  description: 'List all ClickUp workspaces (teams) you have access to.',
  input: {},
  execute: async (_args, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const res = await clickup('GET', '/team');
    const teams = res.teams || [];
    if (!teams.length) return 'No workspaces found.';
    return teams.map(t => `\ud83c\udfe2 ${t.name}  [id: ${t.id}]`).join('\n');
  }
};
