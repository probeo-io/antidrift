import { createClient, fmtIssue } from './client.mjs';

export default {
  description: 'List issues for a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    state: { type: 'string', description: 'State: open, closed, all (default open)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true },
    labels: { type: 'string', description: 'Comma-separated label names (optional)', optional: true }
  },
  execute: async ({ owner, repo, state = 'open', limit = 20, labels }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    let path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=${limit}`;
    if (labels) path += `&labels=${encodeURIComponent(labels)}`;
    const issues = await gh('GET', path);
    // Filter out pull requests (GitHub includes PRs in the issues endpoint)
    const filtered = issues.filter(i => !i.pull_request);
    if (!filtered.length) return 'No issues found.';
    return filtered.map(fmtIssue).join('\n');
  }
};
