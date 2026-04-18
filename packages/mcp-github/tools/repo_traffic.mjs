import { createClient } from './client.mjs';

export default {
  description: 'Get repository clone and view traffic (requires push access).',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' }
  },
  execute: async ({ owner, repo }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/traffic`;
    const [views, clones] = await Promise.all([
      gh('GET', `${base}/views`),
      gh('GET', `${base}/clones`)
    ]);
    const lines = [];
    lines.push(`📊 Traffic for ${owner}/${repo} (last 14 days)`);
    lines.push(`\n   Views: ${views.count} total, ${views.uniques} unique`);
    if (views.views?.length) {
      for (const v of views.views) {
        lines.push(`     ${v.timestamp.slice(0, 10)}  ${v.count} views (${v.uniques} unique)`);
      }
    }
    lines.push(`\n   Clones: ${clones.count} total, ${clones.uniques} unique`);
    if (clones.clones?.length) {
      for (const c of clones.clones) {
        lines.push(`     ${c.timestamp.slice(0, 10)}  ${c.count} clones (${c.uniques} unique)`);
      }
    }
    return lines.join('\n');
  }
};
