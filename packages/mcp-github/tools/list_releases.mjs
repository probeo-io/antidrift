import { createClient } from './client.mjs';

export default {
  description: 'List releases for a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ owner, repo, limit = 20 }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const releases = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${limit}`);
    if (!releases.length) return 'No releases found.';
    return releases.map(r => {
      let line = `🏷️ ${r.tag_name}`;
      if (r.name && r.name !== r.tag_name) line += ` — ${r.name}`;
      line += `  ${r.published_at || r.created_at}`;
      if (r.prerelease) line += '  [pre-release]';
      if (r.draft) line += '  [draft]';
      return line;
    }).join('\n');
  }
};
