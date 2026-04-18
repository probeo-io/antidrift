import { createClient } from './client.mjs';

export default {
  description: 'Get details for a Pages project.',
  input: {
    accountId: { type: 'string', description: 'Account ID' },
    projectName: { type: 'string', description: 'Project name' }
  },
  execute: async ({ accountId, projectName }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/accounts/${accountId}/pages/projects/${projectName}`);
    const p = res.result;
    const lines = [];
    lines.push(`${p.name}  ${p.subdomain || ''}`);
    if (p.source?.type) lines.push(`Source: ${p.source.type} — ${p.source.config?.owner}/${p.source.config?.repo_name}`);
    if (p.build_config?.build_command) lines.push(`Build: ${p.build_config.build_command}`);
    if (p.build_config?.destination_dir) lines.push(`Output: ${p.build_config.destination_dir}`);
    if (p.latest_deployment?.url) lines.push(`Latest: ${p.latest_deployment.url}  [${p.latest_deployment.latest_stage?.name}]`);
    if (p.domains?.length) lines.push(`Domains: ${p.domains.join(', ')}`);
    return lines.join('\n');
  }
};
