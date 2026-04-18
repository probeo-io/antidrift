import { createClient } from './client.mjs';

export default {
  description: 'Get details for a Netlify site by name or ID.',
  input: {
    siteId: { type: 'string', description: 'Site ID or name (e.g. my-site.netlify.app)' }
  },
  execute: async ({ siteId }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('GET', `/sites/${encodeURIComponent(siteId)}`);
    const lines = [];
    lines.push(`${res.name}  ${res.ssl_url || res.url}`);
    if (res.repo?.repo_path) lines.push(`Repo: ${res.repo.repo_path}`);
    if (res.repo?.branch) lines.push(`Branch: ${res.repo.branch}`);
    if (res.build_settings?.cmd) lines.push(`Build: ${res.build_settings.cmd}`);
    if (res.build_settings?.dir) lines.push(`Publish: ${res.build_settings.dir}`);
    lines.push(`Created: ${new Date(res.created_at).toLocaleDateString()}`);
    lines.push(`Updated: ${new Date(res.updated_at).toLocaleDateString()}`);
    lines.push(`[id: ${res.id}]`);
    return lines.join('\n');
  }
};
