import { createClient, GetObjectCommand, PutObjectCommand } from './client.mjs';

export default {
  description: 'Generate a presigned URL for an S3 object (GET or PUT). Useful for sharing files or uploading binary content.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    key: { type: 'string', description: 'Object key' },
    operation: { type: 'string', description: 'get or put (default get)', optional: true },
    expires_in: { type: 'number', description: 'URL expiry in seconds (default 3600)', optional: true },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, key, operation = 'get', expires_in = 3600, region }, ctx) => {
    const { getClient, getSignedUrl } = createClient(ctx.credentials);
    const client = getClient(region);
    const cmd = operation === 'put'
      ? new PutObjectCommand({ Bucket: bucket, Key: key })
      : new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(client, cmd, { expiresIn: expires_in });
    return `🔗 Presigned ${operation.toUpperCase()} URL (expires in ${expires_in}s):\n\n${url}`;
  }
};
