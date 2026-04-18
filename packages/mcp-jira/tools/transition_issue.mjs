import { createClient } from './client.mjs';

export default {
  description: 'Move a Jira issue to a new status by transition name.',
  input: {
    issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
    transitionName: { type: 'string', description: 'The transition name (e.g. "Done", "In Progress")' }
  },
  execute: async ({ issueKey, transitionName }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const res = await jira('GET', `/issue/${issueKey}/transitions`);
    const transitions = res.transitions || [];
    const match = transitions.find(t => t.name.toLowerCase() === transitionName.toLowerCase());
    if (!match) {
      const available = transitions.map(t => t.name).join(', ');
      return `\u2717 Transition "${transitionName}" not found. Available: ${available}`;
    }
    await jira('POST', `/issue/${issueKey}/transitions`, { transition: { id: match.id } });
    return `\u2705 Issue ${issueKey} transitioned to "${match.name}"`;
  }
};
