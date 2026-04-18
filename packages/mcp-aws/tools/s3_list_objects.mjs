import { createClient, sanitize } from './client.mjs';

export default {
  description: 'List objects in an S3 bucket with optional prefix filter',
  input: {
    bucket: { type: 'string', description: 'S3 bucket name' },
    prefix: { type: 'string', description: 'Key prefix to filter by (optional)', optional: true },
    limit: { type: 'number', description: 'Max number of objects to return (default 20)', optional: true }
  },
  execute: async ({ bucket, prefix, limit }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const maxKeys = Math.min(Math.max(parseInt(limit) || 20, 1), 1000);
    let cmd = `s3api list-objects-v2 --bucket ${sanitize(bucket)} --max-keys ${maxKeys}`;
    if (prefix) cmd += ` --prefix ${sanitize(prefix)}`;
    const data = awsCli(cmd);
    const objects = (data.Contents || []).map(o =>
      `${o.Key} (${o.Size} bytes, ${o.LastModified})`
    );
    return objects.length ? objects.join('\n') : 'No objects found.';
  }
};
