import { createClient } from './client.mjs';

export default {
  description: 'List all projects in your Vercel account.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('GET', `/v9/projects?limit=${limit}`);
    if (!res.projects?.length) return 'No projects found.';
    return res.projects.map(p => {
      let line = `${p.name}`;
      if (p.framework) line += `  [${p.framework}]`;
      line += `  [id: ${p.id}]`;
      return line;
    }).join('\n');
  }
};
