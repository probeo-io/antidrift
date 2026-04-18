import { createClient, ListObjectsV2Command, fmtSize, fmtDate } from './client.mjs';

export default {
  description: 'Search for objects in a bucket by key pattern. Lists all objects matching a prefix and optionally filters by substring or suffix.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    prefix: { type: 'string', description: 'Key prefix to search within', optional: true },
    contains: { type: 'string', description: 'Substring the key must contain (optional)', optional: true },
    suffix: { type: 'string', description: 'Key must end with this (e.g. ".csv", ".json")', optional: true },
    limit: { type: 'number', description: 'Max results (default 50)', optional: true },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, prefix = '', contains, suffix, limit = 50, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const matches = [];
    let token;

    do {
      const res = await client.send(new ListObjectsV2Command({
        Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000
      }));
      for (const o of (res.Contents || [])) {
        if (contains && !o.Key.includes(contains)) continue;
        if (suffix && !o.Key.endsWith(suffix)) continue;
        matches.push(o);
        if (matches.length >= limit) break;
      }
      token = res.IsTruncated ? res.NextContinuationToken : null;
    } while (token && matches.length < limit);

    if (!matches.length) return `No objects found in s3://${bucket}/${prefix} matching filters.`;

    const lines = [`Found ${matches.length} objects in s3://${bucket}/:\n`];
    for (const o of matches) {
      lines.push(`  📄 ${o.Key}  ${fmtSize(o.Size)}  ${fmtDate(o.LastModified)}`);
    }
    return lines.join('\n');
  }
};
