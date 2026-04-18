import { createClient } from './client.mjs';

export default {
  description: 'List all Jira projects you have access to.',
  input: {},
  execute: async (_args, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const projects = await jira('GET', '/project');
    if (!projects.length) return 'No projects found.';
    return projects.map(p => `\uD83D\uDCE6 ${p.key} \u2014 ${p.name} [id: ${p.id}]`).join('\n');
  }
};
