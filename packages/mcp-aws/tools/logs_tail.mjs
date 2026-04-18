import { createClient, sanitize } from './client.mjs';

export default {
  description: 'Get recent log events from a CloudWatch log group',
  input: {
    logGroup: { type: 'string', description: 'Log group name (e.g. /aws/lambda/my-function)' },
    limit: { type: 'number', description: 'Max number of events (default 20)', optional: true }
  },
  execute: async ({ logGroup, limit }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const maxEvents = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const data = awsCli(`logs filter-log-events --log-group-name ${sanitize(logGroup)} --limit ${maxEvents} --interleaved`);
    const events = (data.events || []).map(e => {
      const ts = new Date(e.timestamp).toISOString();
      const msg = (e.message || '').trim();
      return `[${ts}] ${msg}`;
    });
    return events.length ? events.join('\n') : 'No recent log events.';
  }
};
