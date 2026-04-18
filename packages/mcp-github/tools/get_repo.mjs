import { createClient } from './client.mjs';

export default {
  description: 'Get detailed information about a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' }
  },
  execute: async ({ owner, repo }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const r = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const lines = [];
    lines.push(`📦 ${r.full_name}`);
    if (r.description) lines.push(`   ${r.description}`);
    lines.push(`   ⭐ ${r.stargazers_count} stars  🔀 ${r.forks_count} forks  👁 ${r.watchers_count} watchers`);
    if (r.language) lines.push(`   Language: ${r.language}`);
    lines.push(`   Default branch: ${r.default_branch}`);
    lines.push(`   Visibility: ${r.visibility || (r.private ? 'private' : 'public')}`);
    if (r.homepage) lines.push(`   Homepage: ${r.homepage}`);
    lines.push(`   Created: ${r.created_at}`);
    lines.push(`   Updated: ${r.updated_at}`);
    lines.push(`   Open issues: ${r.open_issues_count}`);
    return lines.join('\n');
  }
};
