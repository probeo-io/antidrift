import { createClient } from './client.mjs';

export default {
  description: 'Create a new issue in a repository.',
  input: {
    owner: { type: 'string', description: 'Repository owner' },
    repo: { type: 'string', description: 'Repository name' },
    title: { type: 'string', description: 'Issue title' },
    body: { type: 'string', description: 'Issue body (optional)', optional: true },
    labels: { type: 'array', items: { type: 'string' }, description: 'Labels (optional)', optional: true }
  },
  execute: async ({ owner, repo, title, body, labels }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const data = { title };
    if (body) data.body = body;
    if (labels) data.labels = labels;
    const issue = await gh('POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, data);
    return `✅ Created issue #${issue.number}: ${issue.title}\n   ${issue.html_url}`;
  }
};
