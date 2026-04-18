import { createClient } from './client.mjs';

export default {
  description: 'List available statuses for a Jira project.',
  input: {
    projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
  },
  execute: async ({ projectKey }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const issueTypes = await jira('GET', `/project/${projectKey}/statuses`);
    if (!issueTypes.length) return 'No statuses found.';
    const lines = [];
    for (const it of issueTypes) {
      lines.push(`\n${it.name}:`);
      for (const s of it.statuses || []) {
        lines.push(`  \u25CF ${s.name} [id: ${s.id}]`);
      }
    }
    return lines.join('\n');
  }
};
