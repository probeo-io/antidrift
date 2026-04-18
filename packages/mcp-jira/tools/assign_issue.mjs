import { createClient } from './client.mjs';

export default {
  description: 'Assign a Jira issue to a user.',
  input: {
    issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
    assigneeId: { type: 'string', description: 'The account ID of the assignee' }
  },
  execute: async ({ issueKey, assigneeId }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    await jira('PUT', `/issue/${issueKey}/assignee`, { accountId: assigneeId });
    return `\u2705 Issue ${issueKey} assigned`;
  }
};
