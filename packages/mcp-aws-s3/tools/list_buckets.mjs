import { createClient, ListBucketsCommand, fmtDate } from './client.mjs';

export default {
  description: 'List all S3 buckets in the account.',
  input: {
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ region } = {}, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const res = await client.send(new ListBucketsCommand({}));
    const buckets = res.Buckets || [];
    if (!buckets.length) return 'No buckets found.';
    const lines = [`${buckets.length} buckets:\n`];
    for (const b of buckets) {
      lines.push(`  📦 ${b.Name}  created ${fmtDate(b.CreationDate)}`);
    }
    return lines.join('\n');
  }
};
