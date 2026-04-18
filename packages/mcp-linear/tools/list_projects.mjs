import { createClient, formatProject } from './client.mjs';

export default {
  description: 'List projects in Linear with status and progress.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
    const data = await linear(`{
      projects(first: ${limit}, orderBy: updatedAt) {
        nodes { name state progress lead { name } startDate targetDate }
      }
    }`);
    if (!data.projects.nodes.length) return 'No projects found.';
    return data.projects.nodes.map(formatProject).join('\n');
  }
};
