import { createClient } from './client.mjs';

export default {
  description: 'Add a comment to a Linear issue.',
  input: {
    identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
    body: { type: 'string', description: 'Comment text (markdown supported)' }
  },
  execute: async ({ identifier, body }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const [teamKey, num] = identifier.split('-');
    const issueData = await linear(`{ issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) { nodes { id } } }`);
    const issueId = issueData.issues.nodes[0]?.id;
    if (!issueId) return `Issue ${identifier} not found.`;

    await linear(`
      mutation($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) { comment { id } }
      }
    `, { issueId, body });
    return `Comment added to ${identifier}`;
  }
};
