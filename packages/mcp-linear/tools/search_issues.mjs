import { createClient, formatIssue } from './client.mjs';

export default {
  description: 'Search issues in Linear with filters. Returns matching issues with status, priority, and assignee.',
  input: {
    query: { type: 'string', description: 'Text to search for in issue titles and descriptions', optional: true },
    teamKey: { type: 'string', description: 'Team key to filter by (e.g. "ENG", "PROD")', optional: true },
    status: { type: 'string', description: 'Status name to filter by (e.g. "In Progress", "Todo", "Done")', optional: true },
    assignee: { type: 'string', description: 'Assignee name to filter by', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, teamKey, status, assignee, limit = 20 }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const filters = [];
    if (teamKey) filters.push(`team: { key: { eq: "${teamKey}" } }`);
    if (status) filters.push(`state: { name: { eq: "${status}" } }`);
    if (assignee) filters.push(`assignee: { name: { contains: "${assignee}" } }`);
    if (query) filters.push(`or: [{ title: { contains: "${query}" } }, { description: { contains: "${query}" } }]`);
    const filter = filters.length ? `filter: { ${filters.join(', ')} },` : '';

    const data = await linear(`{
      issues(${filter} first: ${limit}, orderBy: updatedAt) {
        nodes { identifier title state { name } priority assignee { name } updatedAt }
      }
    }`);
    if (!data.issues.nodes.length) return 'No issues found.';
    return data.issues.nodes.map(formatIssue).join('\n');
  }
};
