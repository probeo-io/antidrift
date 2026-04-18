import { createClient } from './client.mjs';

export default {
  description: 'Get details for a Jira project.',
  input: {
    projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
  },
  execute: async ({ projectKey }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const project = await jira('GET', `/project/${projectKey}`);
    const lines = [];
    lines.push(`\uD83D\uDCE6 ${project.key} \u2014 ${project.name}`);
    lines.push(`ID: ${project.id}`);
    if (project.description) lines.push(`Description: ${project.description}`);
    if (project.projectTypeKey) lines.push(`Type: ${project.projectTypeKey}`);
    if (project.lead?.displayName) lines.push(`Lead: ${project.lead.displayName}`);
    if (project.url) lines.push(`URL: ${project.url}`);
    return lines.join('\n');
  }
};
