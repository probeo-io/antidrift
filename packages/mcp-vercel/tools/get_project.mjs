import { createClient } from './client.mjs';

export default {
  description: 'Get details for a Vercel project by name or ID.',
  input: {
    project: { type: 'string', description: 'Project name or ID' }
  },
  execute: async ({ project }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('GET', `/v9/projects/${encodeURIComponent(project)}`);
    const lines = [];
    lines.push(`${res.name}  [${res.framework || 'unknown framework'}]`);
    if (res.link?.type) lines.push(`Repo: ${res.link.type} \u2014 ${res.link.org}/${res.link.repo}`);
    lines.push(`Created: ${new Date(res.createdAt).toLocaleDateString()}`);
    lines.push(`Updated: ${new Date(res.updatedAt).toLocaleDateString()}`);
    if (res.targets?.production?.url) lines.push(`Production: https://${res.targets.production.url}`);
    lines.push(`[id: ${res.id}]`);
    return lines.join('\n');
  }
};
