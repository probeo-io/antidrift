import { createClient, sanitize } from './client.mjs';

export default {
  description: 'Invoke a Lambda function and return its response',
  input: {
    functionName: { type: 'string', description: 'Lambda function name or ARN' },
    payload: { type: 'string', description: 'JSON payload to send (optional)', optional: true }
  },
  execute: async ({ functionName, payload }, ctx) => {
    const { awsCliRaw } = createClient(ctx.credentials);
    let cmd = `lambda invoke --function-name ${sanitize(functionName)}`;
    if (payload) {
      // Use JSON.stringify to safely escape the payload
      cmd += ` --payload ${JSON.stringify(payload)}`;
    }
    cmd += ' /dev/stdout';
    const result = awsCliRaw(cmd);
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }
};
