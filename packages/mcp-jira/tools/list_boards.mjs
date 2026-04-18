import { createClient } from './client.mjs';

export default {
  description: 'List Jira boards, optionally filtered by project.',
  input: {
    projectKey: { type: 'string', description: 'Filter by project key (optional)', optional: true }
  },
  execute: async ({ projectKey } = {}, ctx) => {
    const { jira } = createClient(ctx.credentials, ctx.fetch);
    const query = projectKey ? `?projectKeyOrId=${projectKey}` : '';
    const res = await jira('GET', `/rest/agile/1.0/board${query}`);
    const boards = res.values || [];
    if (!boards.length) return 'No boards found.';
    return boards.map(b => `\uD83D\uDCCB ${b.name} \u2014 ${b.type} [id: ${b.id}]`).join('\n');
  }
};
