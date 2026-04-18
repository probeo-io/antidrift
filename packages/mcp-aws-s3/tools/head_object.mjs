import { createClient, HeadObjectCommand, fmtSize, fmtDate } from './client.mjs';

export default {
  description: 'Get metadata for an S3 object without downloading it.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    key: { type: 'string', description: 'Object key' },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, key, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const lines = [`s3://${bucket}/${key}\n`];
    lines.push(`  Size: ${fmtSize(res.ContentLength || 0)}`);
    lines.push(`  Content-Type: ${res.ContentType || '?'}`);
    lines.push(`  Last Modified: ${fmtDate(res.LastModified)}`);
    lines.push(`  ETag: ${res.ETag || '?'}`);
    if (res.VersionId) lines.push(`  Version: ${res.VersionId}`);
    if (res.StorageClass) lines.push(`  Storage Class: ${res.StorageClass}`);
    if (res.ServerSideEncryption) lines.push(`  Encryption: ${res.ServerSideEncryption}`);
    if (res.Metadata && Object.keys(res.Metadata).length) {
      lines.push('  Metadata:');
      for (const [k, v] of Object.entries(res.Metadata)) {
        lines.push(`    ${k}: ${v}`);
      }
    }
    return lines.join('\n');
  }
};
