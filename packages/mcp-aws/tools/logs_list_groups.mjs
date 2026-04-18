import { createClient } from './client.mjs';

export default {
  description: 'List CloudWatch log groups',
  input: {
    limit: { type: 'number', description: 'Max number of log groups (default 50)', optional: true }
  },
  execute: async ({ limit }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const maxGroups = Math.min(Math.max(parseInt(limit) || 50, 1), 50);
    const data = awsCli(`logs describe-log-groups --limit ${maxGroups}`);
    const groups = (data.logGroups || []).map(g => {
      const bytes = g.storedBytes != null ? `${(g.storedBytes / 1024 / 1024).toFixed(1)}MB` : 'n/a';
      return `\u{1f4cb} ${g.logGroupName} (${bytes} stored)`;
    });
    return groups.length ? groups.join('\n') : 'No log groups found.';
  }
};
