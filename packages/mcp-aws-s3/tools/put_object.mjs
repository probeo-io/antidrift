import { createClient, PutObjectCommand, fmtSize } from './client.mjs';

export default {
  description: 'Upload text content to an S3 object. Creates or overwrites the object.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    key: { type: 'string', description: 'Object key' },
    body: { type: 'string', description: 'Content to upload' },
    content_type: { type: 'string', description: 'MIME type (default text/plain)', optional: true },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, key, body, content_type = 'text/plain', region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const res = await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body, ContentType: content_type
    }));
    return `✅ Uploaded s3://${bucket}/${key}  (${fmtSize(Buffer.byteLength(body))}, ETag: ${res.ETag})`;
  }
};
