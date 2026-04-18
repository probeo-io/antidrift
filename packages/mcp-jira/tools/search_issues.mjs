import { createClient } from './client.mjs';

export default {
  description: 'Search Jira issues using JQL (Jira Query Language).',
  input: {
    jql: { type: 'string', description: 'JQL query string (e.g. "project = PROJ AND status = Open")' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ jql, limit = 20 }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const fields = 'summary,status,assignee,priority,issuetype,created,updated';
    const res = await jira('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=${fields}`);
    const issues = res.issues || [];
    if (!issues.length) return 'No issues found.';
    return issues.map(issue => {
      const f = issue.fields;
      const assignee = f.assignee?.displayName || 'Unassigned';
      const priority = f.priority?.name || '';
      const issueType = f.issuetype?.name || '';
      return `\uD83C\uDFAB ${issue.key} [${issueType}] ${f.summary} \u2014 ${f.status?.name || ''} (${assignee}) [${priority}]`;
    }).join('\n');
  }
};
