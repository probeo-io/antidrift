import { createClient, DeleteBucketCommand } from './client.mjs';

export default {
  description: 'Delete an empty S3 bucket.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    return `🗑️ Deleted bucket s3://${bucket}`;
  }
};
