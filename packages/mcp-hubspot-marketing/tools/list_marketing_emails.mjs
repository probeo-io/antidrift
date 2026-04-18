import { createClient } from './client.mjs';

export default {
  description: 'List marketing emails in HubSpot.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/marketing/v3/emails?limit=${limit}`);
    if (!res.results?.length) return 'No marketing emails found.';
    return res.results.map(record => {
      const lines = [];
      lines.push(`\uD83D\uDCE7 ${record.name || 'Untitled'}`);
      if (record.subject) lines.push(`  Subject: ${record.subject}`);
      if (record.state) lines.push(`  Status: ${record.state}`);
      if (record.statistics) {
        const s = record.statistics;
        const stats = [];
        if (s.counters?.sent) stats.push(`sent: ${s.counters.sent}`);
        if (s.counters?.open) stats.push(`opened: ${s.counters.open}`);
        if (s.counters?.click) stats.push(`clicked: ${s.counters.click}`);
        if (stats.length) lines.push(`  Stats: ${stats.join(', ')}`);
      }
      lines.push(`  [id: ${record.id}]`);
      return lines.join('\n');
    }).join('\n\n');
  }
};
