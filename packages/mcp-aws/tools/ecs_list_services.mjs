import { createClient, sanitize } from './client.mjs';

export default {
  description: 'List services in an ECS cluster',
  input: {
    cluster: { type: 'string', description: 'ECS cluster name or ARN' }
  },
  execute: async ({ cluster }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli(`ecs list-services --cluster ${sanitize(cluster)}`);
    const arns = data.serviceArns || [];
    if (!arns.length) return 'No services found in this cluster.';
    return arns.map(arn => arn.split('/').pop()).join('\n');
  }
};
