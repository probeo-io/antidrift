import { createClient } from './client.mjs';

export default {
  description: 'Assign or reassign a Linear issue to a team member.',
  input: {
    identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
    assigneeName: { type: 'string', description: 'Name of the person to assign to' }
  },
  execute: async ({ identifier, assigneeName }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const [teamKey, num] = identifier.split('-');
    const issueData = await linear(`{ issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) { nodes { id } } }`);
    const issueId = issueData.issues.nodes[0]?.id;
    if (!issueId) return `Issue ${identifier} not found.`;

    const userData = await linear(`{ users(filter: { name: { contains: "${assigneeName}" } }) { nodes { id name } } }`);
    const user = userData.users.nodes[0];
    if (!user) return `User "${assigneeName}" not found.`;

    await linear(`
      mutation($id: String!, $assigneeId: String!) {
        issueUpdate(id: $id, input: { assigneeId: $assigneeId }) { issue { identifier } }
      }
    `, { id: issueId, assigneeId: user.id });
    return `${identifier} \u2192 assigned to ${user.name}`;
  }
};
