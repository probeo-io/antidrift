import { createClient } from './client.mjs';

export default {
  description: 'List all S3 buckets in the account',
  input: {},
  execute: async (_args, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli('s3api list-buckets');
    const buckets = (data.Buckets || []).map(b =>
      `\u{1FAA3} ${b.Name} (created ${b.CreationDate})`
    );
    return buckets.length ? buckets.join('\n') : 'No buckets found.';
  }
};
