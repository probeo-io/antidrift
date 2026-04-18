import { createClient } from './client.mjs';

export default {
  description: 'Get details for a specific deployment.',
  input: {
    deploymentId: { type: 'string', description: 'Deployment ID or URL' }
  },
  execute: async ({ deploymentId }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('GET', `/v13/deployments/${encodeURIComponent(deploymentId)}`);
    const lines = [];
    lines.push(`${res.url}  [${res.readyState}]`);
    lines.push(`Project: ${res.name}`);
    if (res.meta?.githubCommitMessage) lines.push(`Commit: ${res.meta.githubCommitMessage}`);
    if (res.meta?.githubCommitRef) lines.push(`Branch: ${res.meta.githubCommitRef}`);
    lines.push(`Created: ${new Date(res.createdAt).toLocaleString()}`);
    if (res.ready) lines.push(`Ready: ${new Date(res.ready).toLocaleString()}`);
    if (res.target) lines.push(`Target: ${res.target}`);
    return lines.join('\n');
  }
};
