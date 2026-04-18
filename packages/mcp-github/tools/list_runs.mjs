import { createClient } from './client.mjs';

export default {
  description: 'List recent workflow runs for a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ owner, repo, limit = 20 }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const res = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=${limit}`);
    if (!res.workflow_runs?.length) return 'No workflow runs found.';
    return res.workflow_runs.map(r => {
      const icon = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : r.status === 'in_progress' ? '🔄' : '⏸️';
      return `${icon} ${r.name} #${r.run_number}  ${r.head_branch}  ${r.conclusion || r.status}  ${r.created_at}`;
    }).join('\n');
  }
};
