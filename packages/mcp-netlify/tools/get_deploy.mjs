import { createClient } from './client.mjs';

export default {
  description: 'Get details for a specific deploy.',
  input: {
    deployId: { type: 'string', description: 'Deploy ID' }
  },
  execute: async ({ deployId }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('GET', `/deploys/${deployId}`);
    const lines = [];
    lines.push(`${res.id}  [${res.state}]`);
    if (res.ssl_url) lines.push(`URL: ${res.ssl_url}`);
    if (res.branch) lines.push(`Branch: ${res.branch}`);
    if (res.title) lines.push(`Title: ${res.title}`);
    if (res.commit_ref) lines.push(`Commit: ${res.commit_ref.slice(0, 8)}`);
    if (res.deploy_time) lines.push(`Build time: ${res.deploy_time}s`);
    if (res.error_message) lines.push(`Error: ${res.error_message}`);
    lines.push(`Created: ${new Date(res.created_at).toLocaleString()}`);
    return lines.join('\n');
  }
};
