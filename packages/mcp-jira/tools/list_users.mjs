import { createClient } from './client.mjs';

export default {
  description: 'List assignable users for a Jira project.',
  input: {
    projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
  },
  execute: async ({ projectKey }, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const users = await jira('GET', `/user/assignable/search?project=${projectKey}`);
    if (!users.length) return 'No assignable users found.';
    return users.map(u => `\uD83D\uDC64 ${u.displayName} \u2014 ${u.emailAddress || 'no email'} [id: ${u.accountId}]`).join('\n');
  }
};
