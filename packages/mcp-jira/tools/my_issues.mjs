import { createClient } from './client.mjs';

export default {
  description: 'Get Jira issues assigned to the current user (unresolved, ordered by priority).',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 } = {}, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const jql = 'assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC';
    const fields = 'summary,status,assignee,priority,issuetype,created,updated';
    const res = await jira('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=${fields}`);
    const issues = res.issues || [];
    if (!issues.length) return 'No issues assigned to you.';
    return issues.map(issue => {
      const f = issue.fields;
      const priority = f.priority?.name || '';
      const issueType = f.issuetype?.name || '';
      return `\uD83C\uDFAB ${issue.key} [${issueType}] ${f.summary} \u2014 ${f.status?.name || ''} [${priority}]`;
    }).join('\n');
  }
};
