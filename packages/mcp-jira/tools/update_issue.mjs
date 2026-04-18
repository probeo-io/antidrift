import { createClient, toAdf } from './client.mjs';

export default {
  description: 'Update fields on a Jira issue (summary, description, priority, assignee).',
  input: {
    issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
    summary: { type: 'string', description: 'New summary (optional)', optional: true },
    description: { type: 'string', description: 'New description (optional, plain text)', optional: true },
    priority: { type: 'string', description: 'New priority name (optional)', optional: true },
    assigneeId: { type: 'string', description: 'New assignee account ID (optional)', optional: true }
  },
  execute: async ({ issueKey, summary, description, priority, assigneeId }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const fields = {};
    if (summary) fields.summary = summary;
    if (description) fields.description = toAdf(description);
    if (priority) fields.priority = { name: priority };
    if (assigneeId) fields.assignee = { accountId: assigneeId };

    await jira('PUT', `/issue/${issueKey}`, { fields });
    return `\u2705 Issue ${issueKey} updated`;
  }
};
