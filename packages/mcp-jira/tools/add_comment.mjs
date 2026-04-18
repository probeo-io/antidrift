import { createClient, toAdf } from './client.mjs';

export default {
  description: 'Add a comment to a Jira issue.',
  input: {
    issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
    body: { type: 'string', description: 'Comment text' }
  },
  execute: async ({ issueKey, body }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('POST', `/issue/${issueKey}/comment`, { body: toAdf(body) });
    return `\u2705 Comment added to ${issueKey}`;
  }
};
