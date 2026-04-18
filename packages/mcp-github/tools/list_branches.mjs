import { createClient } from './client.mjs';

export default {
  description: 'List branches for a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' }
  },
  execute: async ({ owner, repo }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const branches = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
    if (!branches.length) return 'No branches found.';
    return branches.map(b => {
      const shield = b.protected ? '🛡️' : '  ';
      return `${shield} ${b.name}  ${b.commit?.sha?.slice(0, 7) || ''}`;
    }).join('\n');
  }
};
