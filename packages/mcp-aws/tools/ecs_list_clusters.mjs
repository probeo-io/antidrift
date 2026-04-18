import { createClient } from './client.mjs';

export default {
  description: 'List all ECS clusters',
  input: {},
  execute: async (_args, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli('ecs list-clusters');
    const arns = data.clusterArns || [];
    if (!arns.length) return 'No ECS clusters found.';
    return arns.map(arn => {
      const name = arn.split('/').pop();
      return `\u{1f4e6} ${name}`;
    }).join('\n');
  }
};
