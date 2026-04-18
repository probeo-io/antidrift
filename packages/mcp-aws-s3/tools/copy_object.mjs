import { createClient, CopyObjectCommand } from './client.mjs';

export default {
  description: 'Copy an object within or between S3 buckets.',
  input: {
    source_bucket: { type: 'string', description: 'Source bucket name' },
    source_key: { type: 'string', description: 'Source object key' },
    dest_bucket: { type: 'string', description: 'Destination bucket name' },
    dest_key: { type: 'string', description: 'Destination object key' },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ source_bucket, source_key, dest_bucket, dest_key, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);
    await client.send(new CopyObjectCommand({
      Bucket: dest_bucket,
      Key: dest_key,
      CopySource: `${source_bucket}/${source_key}`
    }));
    return `✅ Copied s3://${source_bucket}/${source_key} → s3://${dest_bucket}/${dest_key}`;
  }
};
