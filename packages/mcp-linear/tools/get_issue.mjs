import { createClient, formatIssue } from './client.mjs';

export default {
  description: 'Get full details for a Linear issue by identifier (e.g. ENG-123).',
  input: {
    identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' }
  },
  execute: async ({ identifier }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const [teamKey, num] = identifier.split('-');
    const data = await linear(`{
      issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) {
        nodes {
          identifier title description state { name } priority
          assignee { name } creator { name } project { name }
          labels { nodes { name } }
          comments { nodes { body user { name } createdAt } }
          createdAt updatedAt
        }
      }
    }`);
    const issue = data.issues.nodes[0];
    if (!issue) return `Issue ${identifier} not found.`;

    const lines = [];
    lines.push(`${issue.identifier} \u2014 ${issue.title}`);
    lines.push(`Status: ${issue.state?.name || 'Unknown'}`);
    const priority = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || '';
    if (priority && priority !== 'None') lines.push(`Priority: ${priority}`);
    if (issue.assignee?.name) lines.push(`Assignee: ${issue.assignee.name}`);
    if (issue.creator?.name) lines.push(`Creator: ${issue.creator.name}`);
    if (issue.project?.name) lines.push(`Project: ${issue.project.name}`);
    if (issue.labels?.nodes?.length) lines.push(`Labels: ${issue.labels.nodes.map(l => l.name).join(', ')}`);
    if (issue.description) lines.push(`\n${issue.description}`);
    if (issue.comments?.nodes?.length) {
      lines.push(`\n--- Comments (${issue.comments.nodes.length}) ---`);
      for (const c of issue.comments.nodes.slice(0, 10)) {
        lines.push(`${c.user?.name || 'Unknown'} (${new Date(c.createdAt).toLocaleDateString()}): ${c.body.slice(0, 200)}`);
      }
    }
    return lines.join('\n');
  }
};
