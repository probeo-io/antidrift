import { createClient } from './client.mjs';

export default {
  description: 'Get issue details and comments.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    number: { type: 'number', description: 'Issue number' }
  },
  execute: async ({ owner, repo, number }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const issue = await gh('GET', `${base}/issues/${number}`);
    const comments = await gh('GET', `${base}/issues/${number}/comments?per_page=50`);
    const lines = [];
    lines.push(`#${issue.number} ${issue.state === 'open' ? '🟢' : '🔴'} ${issue.title}`);
    lines.push(`   By: ${issue.user?.login || '?'}  •  ${issue.created_at}`);
    if (issue.labels?.length) lines.push(`   Labels: ${issue.labels.map(l => l.name).join(', ')}`);
    if (issue.assignees?.length) lines.push(`   Assignees: ${issue.assignees.map(a => a.login).join(', ')}`);
    if (issue.body) lines.push(`\n${issue.body}`);
    if (comments.length) {
      lines.push(`\n--- Comments (${comments.length}) ---`);
      for (const c of comments) {
        lines.push(`\n💬 ${c.user?.login || '?'} (${c.created_at}):`);
        lines.push(c.body);
      }
    }
    return lines.join('\n');
  }
};
