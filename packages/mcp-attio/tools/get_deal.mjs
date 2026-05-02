import { createClient } from './client.mjs';

function daysBetween(from, until) {
  const end = until ? new Date(until) : new Date();
  return Math.round((end - new Date(from)) / 86400000);
}

export default {
  description: 'Get full details for a deal including complete stage history and time spent in each stage.',
  input: {
    recordId: { type: 'string', description: 'The deal record ID' }
  },
  execute: async ({ recordId }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('GET', `/objects/deals/records/${recordId}`);
    const vals = res.data.values || {};
    const lines = [];

    const name = vals.name?.[0]?.value || 'Unknown';
    const value = vals.value?.[0]?.currency_value;
    lines.push(`💰 ${name}${value != null ? `  •  $${value}` : ''}  [id: ${recordId}]`);

    const stages = (vals.stage || []).slice().sort((a, b) => new Date(a.active_from || a.created_at) - new Date(b.active_from || b.created_at));
    if (stages.length) {
      lines.push('');
      lines.push('Stage history:');
      for (const s of stages) {
        const title = s.status?.title || 'Unknown';
        const from = (s.active_from || s.created_at || '').slice(0, 10);
        const until = s.active_until ? s.active_until.slice(0, 10) : null;
        const days = (s.active_from || s.created_at) ? daysBetween(s.active_from || s.created_at, s.active_until) : null;
        const range = until ? `${from} → ${until}` : `${from} → now`;
        lines.push(`  ${title.padEnd(20)} ${range}${days != null ? `  (${days}d)` : ''}`);
      }
      const first = stages[0];
      const last = stages[stages.length - 1];
      if (first && (first.active_from || first.created_at)) {
        const total = daysBetween(first.active_from || first.created_at, last.active_until || null);
        lines.push('');
        lines.push(`Total: ${total}d`);
      }
    }

    return lines.join('\n');
  }
};
