import { createClient } from './client.mjs';

export default {
  description: 'List deployments for a Pages project.',
  input: {
    accountId: { type: 'string', description: 'Account ID' },
    projectName: { type: 'string', description: 'Project name' },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ accountId, projectName, limit = 10 }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('GET', `/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=${limit}`);
    if (!res.result?.length) return 'No deployments found.';
    return res.result.map(d => {
      let line = `${d.id.slice(0, 8)}  [${d.latest_stage?.name || d.environment}]`;
      if (d.deployment_trigger?.metadata?.commit_message) line += `  "${d.deployment_trigger.metadata.commit_message.slice(0, 50)}"`;
      line += `  ${new Date(d.created_on).toLocaleString()}`;
      return line;
    }).join('\n');
  }
};
