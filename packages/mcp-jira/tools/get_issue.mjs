import { createClient, extractAdfText } from './client.mjs';

export default {
  description: 'Get full details for a Jira issue, including description and comments.',
  input: {
    issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' }
  },
  execute: async ({ issueKey }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const issue = await jira('GET', `/issue/${issueKey}?fields=summary,description,status,assignee,reporter,priority,issuetype,created,updated,comment`);
    const f = issue.fields;
    const lines = [];
    lines.push(`\uD83C\uDFAB ${issue.key} [${f.issuetype?.name || ''}] ${f.summary}`);
    lines.push(`Status: ${f.status?.name || 'unknown'}`);
    lines.push(`Priority: ${f.priority?.name || 'None'}`);
    if (f.assignee?.displayName) lines.push(`Assignee: ${f.assignee.displayName}`);
    if (f.reporter?.displayName) lines.push(`Reporter: ${f.reporter.displayName}`);
    lines.push(`Created: ${f.created}`);
    lines.push(`Updated: ${f.updated}`);

    if (f.description) {
      const descText = extractAdfText(f.description);
      if (descText.trim()) lines.push(`\nDescription:\n${descText}`);
    }

    const comments = f.comment?.comments || [];
    if (comments.length) {
      lines.push('\nComments:');
      for (const c of comments) {
        const author = c.author?.displayName || 'unknown';
        const created = c.created || '';
        const body = extractAdfText(c.body);
        lines.push(`  \uD83D\uDCAC ${author} (${created}): ${body}`);
      }
    }

    return lines.join('\n');
  }
};
