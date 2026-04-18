import { createClient } from './client.mjs';

export default {
  description: 'Move a Linear issue to a different status (e.g. "In Progress", "Done").',
  input: {
    identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
    status: { type: 'string', description: 'Target status name (e.g. "In Progress", "Done", "Todo")' }
  },
  execute: async ({ identifier, status }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const [teamKey, num] = identifier.split('-');
    const issueData = await linear(`{
      issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) {
        nodes { id team { id } }
      }
    }`);
    const issue = issueData.issues.nodes[0];
    if (!issue) return `Issue ${identifier} not found.`;

    const stateData = await linear(`{
      workflowStates(filter: { team: { id: { eq: "${issue.team.id}" } }, name: { eq: "${status}" } }) {
        nodes { id name }
      }
    }`);
    const state = stateData.workflowStates.nodes[0];
    if (!state) return `Status "${status}" not found for this team.`;

    await linear(`
      mutation($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) { issue { identifier title state { name } } }
      }
    `, { id: issue.id, stateId: state.id });
    return `${identifier} \u2192 ${status}`;
  }
};
