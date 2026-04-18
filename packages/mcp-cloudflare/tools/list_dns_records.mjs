import { createClient } from './client.mjs';

export default {
  description: 'List DNS records for a zone.',
  input: {
    zoneId: { type: 'string', description: 'Zone ID' },
    type: { type: 'string', description: 'Filter by record type (A, AAAA, CNAME, MX, TXT, etc.)', optional: true },
    limit: { type: 'number', description: 'Max results (default 50)', optional: true }
  },
  execute: async ({ zoneId, type, limit = 50 }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    let path = `/zones/${zoneId}/dns_records?per_page=${limit}`;
    if (type) path += `&type=${type}`;
    const res = await cf('GET', path);
    if (!res.result?.length) return 'No DNS records found.';
    return res.result.map(r => {
      let line = `${r.type.padEnd(6)} ${r.name}  →  ${r.content}`;
      if (r.proxied) line += '  [proxied]';
      if (r.ttl !== 1) line += `  TTL: ${r.ttl}`;
      line += `  [id: ${r.id}]`;
      return line;
    }).join('\n');
  }
};
