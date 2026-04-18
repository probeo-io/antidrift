import { createClient } from './client.mjs';

export default {
  description: 'Get the diff for a pull request.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    number: { type: 'number', description: 'PR number' }
  },
  execute: async ({ owner, repo, number }, ctx) => {
    const token = ctx.credentials.token;
    const res = await ctx.fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.diff',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    return await res.text();
  }
};
