import { createClient } from './client.mjs';

export default {
  description: 'Get full details and stats for a marketing email by ID.',
  input: {
    emailId: { type: 'string', description: 'The marketing email ID' }
  },
  execute: async ({ emailId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/marketing/v3/emails/${emailId}`);
    const lines = [];
    lines.push(`\uD83D\uDCE7 ${res.name || 'Untitled'}`);
    if (res.subject) lines.push(`Subject: ${res.subject}`);
    if (res.state) lines.push(`Status: ${res.state}`);
    if (res.type) lines.push(`Type: ${res.type}`);
    if (res.publishDate) lines.push(`Published: ${res.publishDate}`);
    if (res.statistics) {
      const s = res.statistics;
      if (s.counters) {
        for (const [key, value] of Object.entries(s.counters)) {
          if (value != null) lines.push(`  ${key}: ${value}`);
        }
      }
      if (s.ratios) {
        for (const [key, value] of Object.entries(s.ratios)) {
          if (value != null) lines.push(`  ${key}: ${(value * 100).toFixed(1)}%`);
        }
      }
    }
    lines.push(`[id: ${emailId}]`);
    return lines.join('\n');
  }
};
