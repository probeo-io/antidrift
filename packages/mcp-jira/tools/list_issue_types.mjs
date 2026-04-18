import { createClient } from './client.mjs';

export default {
  description: 'List issue types available for a Jira project.',
  input: {
    projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
  },
  execute: async ({ projectKey }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const project = await jira('GET', `/project/${projectKey}`);
    const issueTypes = project.issueTypes || [];
    if (!issueTypes.length) return 'No issue types found.';
    return issueTypes.map(t => `\u25CF ${t.name}${t.subtask ? ' (subtask)' : ''} \u2014 ${t.description || ''} [id: ${t.id}]`).join('\n');
  }
};
