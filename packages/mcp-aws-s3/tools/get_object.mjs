import { createClient, GetObjectCommand, fmtSize, fmtDate } from './client.mjs';

export default {
  description: 'Read an object from S3. Returns the content as text. For binary files, use s3_presign instead.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    key: { type: 'string', description: 'Object key' },
    region: { type: 'string', description: 'AWS region (optional)', optional: true },
    max_bytes: { type: 'number', description: 'Max bytes to read (default 1MB)', optional: true }
  },
  execute: async ({ bucket, key, region, max_bytes = 1048576 }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const params = { Bucket: bucket, Key: key };
    if (max_bytes) params.Range = `bytes=0-${max_bytes - 1}`;

    const res = await client.send(new GetObjectCommand(params));
    const body = await res.Body.transformToString();
    const lines = [`s3://${bucket}/${key}`];
    lines.push(`Content-Type: ${res.ContentType || '?'}  Size: ${fmtSize(res.ContentLength || 0)}  Modified: ${fmtDate(res.LastModified)}`);
    if (res.VersionId) lines.push(`Version: ${res.VersionId}`);
    lines.push('');
    lines.push(body);
    return lines.join('\n');
  }
};
