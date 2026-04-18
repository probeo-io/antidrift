import { createClient } from './client.mjs';

export default {
  description: 'Create a DNS record.',
  input: {
    zoneId: { type: 'string', description: 'Zone ID' },
    type: { type: 'string', description: 'Record type (A, AAAA, CNAME, MX, TXT)' },
    name: { type: 'string', description: 'Record name (e.g. "www" or "@")' },
    content: { type: 'string', description: 'Record value (IP, hostname, or text)' },
    proxied: { type: 'boolean', description: 'Enable Cloudflare proxy (default: false)', optional: true },
    ttl: { type: 'number', description: 'TTL in seconds (1 = auto)', optional: true }
  },
  execute: async ({ zoneId, type, name, content, proxied = false, ttl = 1 }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    const res = await cf('POST', `/zones/${zoneId}/dns_records`, { type, name, content, proxied, ttl });
    return `Created ${res.result.type} record: ${res.result.name} → ${res.result.content}  [id: ${res.result.id}]`;
  }
};
