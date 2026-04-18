import { createClient, formatIssue } from './client.mjs';

export default {
  description: 'Get the active cycle (sprint) for a team with all its issues.',
  input: {
    teamKey: { type: 'string', description: 'Team key (e.g. "ENG")' }
  },
  execute: async ({ teamKey }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const data = await linear(`{
      teams(filter: { key: { eq: "${teamKey}" } }) {
        nodes {
          activeCycle {
            number startsAt endsAt progress
            issues { nodes { identifier title state { name } priority assignee { name } } }
          }
        }
      }
    }`);
    const cycle = data.teams.nodes[0]?.activeCycle;
    if (!cycle) return `No active cycle for team ${teamKey}.`;

    const lines = [];
    lines.push(`Cycle ${cycle.number}  ${Math.round((cycle.progress || 0) * 100)}% complete`);
    lines.push(`${new Date(cycle.startsAt).toLocaleDateString()} \u2192 ${new Date(cycle.endsAt).toLocaleDateString()}`);
    if (cycle.issues?.nodes?.length) {
      lines.push(`\n${cycle.issues.nodes.length} issues:`);
      cycle.issues.nodes.forEach(i => lines.push(formatIssue(i)));
    }
    return lines.join('\n');
  }
};
