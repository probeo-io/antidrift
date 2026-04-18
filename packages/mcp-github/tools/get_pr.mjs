import { createClient } from './client.mjs';

export default {
  description: 'Get pull request details and files changed.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    number: { type: 'number', description: 'PR number' }
  },
  execute: async ({ owner, repo, number }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const pr = await gh('GET', `${base}/pulls/${number}`);
    const files = await gh('GET', `${base}/pulls/${number}/files?per_page=100`);
    const lines = [];
    lines.push(`#${pr.number} ${pr.state === 'open' ? '🟢' : pr.merged_at ? '🟣 merged' : '🔴 closed'} ${pr.title}`);
    lines.push(`   ${pr.head?.ref || '?'} → ${pr.base?.ref || '?'}  by ${pr.user?.login || '?'}`);
    lines.push(`   +${pr.additions} / -${pr.deletions}  (${pr.changed_files} files)`);
    if (pr.body) lines.push(`\n${pr.body}`);
    if (files.length) {
      lines.push(`\n--- Files Changed (${files.length}) ---`);
      for (const f of files) {
        lines.push(`  ${f.status === 'added' ? '➕' : f.status === 'removed' ? '➖' : '✏️'}  ${f.filename}  (+${f.additions} -${f.deletions})`);
      }
    }
    return lines.join('\n');
  }
};
