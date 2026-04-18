import { createClient, sanitize } from './client.mjs';

export default {
  description: 'Read a text file from S3 (returns content as string)',
  input: {
    bucket: { type: 'string', description: 'S3 bucket name' },
    key: { type: 'string', description: 'Object key (path)' }
  },
  execute: async ({ bucket, key }, ctx) => {
    const { awsCliRaw } = createClient(ctx.credentials);
    const content = awsCliRaw(`s3 cp s3://${sanitize(bucket)}/${sanitize(key)} -`);
    return content;
  }
};
