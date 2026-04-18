import { createClient } from './client.mjs';

export default {
  description: 'List all teams in your Linear workspace.',
  input: {},
  execute: async (_args, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const data = await linear(`{
      teams { nodes { key name description issueCount } }
    }`);
    if (!data.teams.nodes.length) return 'No teams found.';
    return data.teams.nodes.map(t => `${t.key} \u2014 ${t.name}  (${t.issueCount} issues)`).join('\n');
  }
};
