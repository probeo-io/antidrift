import { createClient } from './client.mjs';

export default {
  description: 'Read a file from a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    path: { type: 'string', description: 'File path in the repo' },
    ref: { type: 'string', description: 'Branch or commit (default main)', optional: true }
  },
  execute: async ({ owner, repo, path, ref = 'main' }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const data = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
    if (data.type !== 'file') return `"${path}" is a ${data.type}, not a file.`;
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return `📄 ${path} (${data.size} bytes, branch: ${ref})\n\n${content}`;
  }
};
