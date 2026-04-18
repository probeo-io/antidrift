import { createClient, ListObjectsV2Command, fmtSize, fmtDate } from './client.mjs';

export default {
  description: 'List objects in an S3 bucket. Supports prefix filtering and pagination.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    prefix: { type: 'string', description: 'Key prefix to filter (e.g. "logs/2024/")', optional: true },
    delimiter: { type: 'string', description: 'Delimiter for folder-like listing (default "/")', optional: true },
    limit: { type: 'number', description: 'Max results (default 100)', optional: true },
    continuation_token: { type: 'string', description: 'Token for next page (from previous response)', optional: true },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, prefix, delimiter = '/', limit = 100, continuation_token, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const params = { Bucket: bucket, MaxKeys: limit };
    if (prefix) params.Prefix = prefix;
    if (delimiter) params.Delimiter = delimiter;
    if (continuation_token) params.ContinuationToken = continuation_token;

    const res = await client.send(new ListObjectsV2Command(params));
    const lines = [`s3://${bucket}/${prefix || ''}\n`];

    const folders = res.CommonPrefixes || [];
    if (folders.length) {
      for (const f of folders) {
        lines.push(`  📁 ${f.Prefix}`);
      }
    }

    const objects = res.Contents || [];
    if (objects.length) {
      for (const o of objects) {
        lines.push(`  📄 ${o.Key}  ${fmtSize(o.Size)}  ${fmtDate(o.LastModified)}`);
      }
    }

    if (!folders.length && !objects.length) {
      lines.push('  (empty)');
    }

    lines.push(`\n  Showing ${objects.length} objects, ${folders.length} prefixes`);
    if (res.IsTruncated) {
      lines.push(`  More results available — continuation_token: ${res.NextContinuationToken}`);
    }
    return lines.join('\n');
  }
};
