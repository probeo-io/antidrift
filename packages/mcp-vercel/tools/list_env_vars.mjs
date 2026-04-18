import { createClient } from './client.mjs';

export default {
  description: 'List environment variables for a project.',
  input: {
    project: { type: 'string', description: 'Project name or ID' }
  },
  execute: async ({ project }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('GET', `/v9/projects/${encodeURIComponent(project)}/env`);
    if (!res.envs?.length) return 'No environment variables found.';
    return res.envs.map(e => {
      const targets = e.target?.join(', ') || 'all';
      return `${e.key}  [${e.type}]  targets: ${targets}`;
    }).join('\n');
  }
};
