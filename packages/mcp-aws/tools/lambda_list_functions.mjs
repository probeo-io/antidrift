import { createClient } from './client.mjs';

export default {
  description: 'List all Lambda functions in the current region',
  input: {},
  execute: async (_args, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli('lambda list-functions');
    const fns = (data.Functions || []).map(f =>
      `\u26a1 ${f.FunctionName} \u2014 ${f.Runtime || 'n/a'}, ${f.MemorySize}MB, last modified ${f.LastModified}`
    );
    return fns.length ? fns.join('\n') : 'No Lambda functions found.';
  }
};
