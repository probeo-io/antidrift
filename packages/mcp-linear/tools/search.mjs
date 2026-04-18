import { createClient, formatIssue } from './client.mjs';

export default {
  description: 'Full-text search across all issues in Linear.',
  input: {
    query: { type: 'string', description: 'Search text' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ query, limit = 20 }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const data = await linear(`{
      searchIssues(term: "${query}", first: ${limit}) {
        nodes { identifier title state { name } priority assignee { name } }
      }
    }`);
    if (!data.searchIssues.nodes.length) return `No results for "${query}".`;
    return data.searchIssues.nodes.map(formatIssue).join('\n');
  }
};
