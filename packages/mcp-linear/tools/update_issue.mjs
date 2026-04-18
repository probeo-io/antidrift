import { createClient } from './client.mjs';

export default {
  description: 'Update an existing Linear issue.',
  input: {
    identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
    title: { type: 'string', description: 'New title', optional: true },
    description: { type: 'string', description: 'New description', optional: true },
    priority: { type: 'number', description: 'Priority: 1=Urgent, 2=High, 3=Medium, 4=Low', optional: true }
  },
  execute: async ({ identifier, title, description, priority }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const [teamKey, num] = identifier.split('-');
    const issueData = await linear(`{ issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) { nodes { id } } }`);
    const issueId = issueData.issues.nodes[0]?.id;
    if (!issueId) return `Issue ${identifier} not found.`;

    const input = {};
    if (title) input.title = title;
    if (description) input.description = description;
    if (priority) input.priority = priority;

    const data = await linear(`
      mutation($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) { issue { identifier title state { name } } }
      }
    `, { id: issueId, input });
    const issue = data.issueUpdate.issue;
    return `Updated ${issue.identifier} \u2014 ${issue.title}`;
  }
};
