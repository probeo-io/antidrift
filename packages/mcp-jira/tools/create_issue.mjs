import { createClient, toAdf } from './client.mjs';

export default {
  description: 'Create a new Jira issue.',
  input: {
    projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' },
    summary: { type: 'string', description: 'Issue summary/title' },
    description: { type: 'string', description: 'Issue description (plain text, will be converted to ADF)', optional: true },
    issueType: { type: 'string', description: 'Issue type name (default "Task")', optional: true },
    priority: { type: 'string', description: 'Priority name (e.g. "High", "Medium", "Low")', optional: true },
    assigneeId: { type: 'string', description: 'Assignee account ID', optional: true }
  },
  execute: async ({ projectKey, summary, description, issueType = 'Task', priority, assigneeId }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const fields = {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType }
    };
    if (description) fields.description = toAdf(description);
    if (priority) fields.priority = { name: priority };
    if (assigneeId) fields.assignee = { accountId: assigneeId };

    const res = await jira('POST', '/issue', { fields });
    return `\u2705 Created issue: ${res.key} \u2014 "${summary}"`;
  }
};
