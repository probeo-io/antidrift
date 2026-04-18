import { createClient, CreateBucketCommand } from './client.mjs';

export default {
  description: 'Create a new S3 bucket.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    region: { type: 'string', description: 'AWS region (e.g. us-east-1)' }
  },
  execute: async ({ bucket, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    const params = { Bucket: bucket };
    if (region !== 'us-east-1') {
      params.CreateBucketConfiguration = { LocationConstraint: region };
    }
    await client.send(new CreateBucketCommand(params));
    return `✅ Created bucket s3://${bucket} in ${region}`;
  }
};
