import { createClient } from './client.mjs';

export default {
  description: 'List recent deployments for a project.',
  input: {
    project: { type: 'string', description: 'Project name or ID' },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true },
    state: { type: 'string', description: 'Filter by state: BUILDING, ERROR, INITIALIZING, QUEUED, READY, CANCELED', optional: true }
  },
  execute: async ({ project, limit = 10, state }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    let path = `/v6/deployments?projectId=${encodeURIComponent(project)}&limit=${limit}`;
    if (state) path += `&state=${state}`;
    const res = await vc('GET', path);
    if (!res.deployments?.length) return 'No deployments found.';
    return res.deployments.map(d => {
      let line = `${d.url || d.uid}  [${d.state || d.readyState}]`;
      if (d.meta?.githubCommitMessage) line += `  "${d.meta.githubCommitMessage.slice(0, 60)}"`;
      line += `  ${new Date(d.created).toLocaleString()}`;
      return line;
    }).join('\n');
  }
};
