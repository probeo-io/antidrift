import { createClient, sanitize } from './client.mjs';

export default {
  description: 'Get detailed configuration for a Lambda function',
  input: {
    functionName: { type: 'string', description: 'Lambda function name or ARN' }
  },
  execute: async ({ functionName }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    return awsCli(`lambda get-function-configuration --function-name ${sanitize(functionName)}`);
  }
};
