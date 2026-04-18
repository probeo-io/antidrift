import { createClient } from './client.mjs';

export default {
  description: 'Show current AWS identity (account ID, user ARN, user ID)',
  input: {},
  execute: async (_args, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const identity = awsCli('sts get-caller-identity');
    return {
      account: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId,
    };
  }
};
