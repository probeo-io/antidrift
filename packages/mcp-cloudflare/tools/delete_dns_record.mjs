import { createClient } from './client.mjs';

export default {
  description: 'Delete a DNS record.',
  input: {
    zoneId: { type: 'string', description: 'Zone ID' },
    recordId: { type: 'string', description: 'DNS record ID' }
  },
  execute: async ({ zoneId, recordId }, ctx) => {
    const { cf } = createClient(ctx.credentials, ctx.fetch);
    await cf('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
    return `Deleted DNS record ${recordId}`;
  }
};
