import { createClient, DeleteObjectCommand } from './client.mjs';

export default {
  description: 'Delete an object from S3.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    key: { type: 'string', description: 'Object key' },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, key, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return `🗑️ Deleted s3://${bucket}/${key}`;
  }
};
