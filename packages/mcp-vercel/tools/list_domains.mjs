import { createClient } from './client.mjs';

export default {
  description: 'List domains for a project.',
  input: {
    project: { type: 'string', description: 'Project name or ID' }
  },
  execute: async ({ project }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('GET', `/v9/projects/${encodeURIComponent(project)}/domains`);
    if (!res.domains?.length) return 'No domains found.';
    return res.domains.map(d => {
      let line = `${d.name}`;
      if (d.redirect) line += `  \u2192 ${d.redirect}`;
      if (d.verified !== undefined) line += d.verified ? '  [verified]' : '  [unverified]';
      return line;
    }).join('\n');
  }
};
