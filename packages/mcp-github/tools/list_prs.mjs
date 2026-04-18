import { createClient, fmtPR } from './client.mjs';

export default {
  description: 'List pull requests for a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    state: { type: 'string', description: 'State: open, closed, all (default open)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ owner, repo, state = 'open', limit = 20 }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const prs = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&per_page=${limit}`);
    if (!prs.length) return 'No pull requests found.';
    return prs.map(fmtPR).join('\n');
  }
};
