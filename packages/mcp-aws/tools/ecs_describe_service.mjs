import { createClient, sanitize } from './client.mjs';

export default {
  description: 'Get details for an ECS service (running count, desired count, recent events)',
  input: {
    cluster: { type: 'string', description: 'ECS cluster name or ARN' },
    service: { type: 'string', description: 'Service name or ARN' }
  },
  execute: async ({ cluster, service }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli(`ecs describe-services --cluster ${sanitize(cluster)} --services ${sanitize(service)}`);
    const svc = (data.services || [])[0];
    if (!svc) return 'Service not found.';
    const events = (svc.events || []).slice(0, 5).map(e =>
      `  ${e.createdAt}: ${e.message}`
    );
    return [
      `Service: ${svc.serviceName}`,
      `Status: ${svc.status}`,
      `Running: ${svc.runningCount} / ${svc.desiredCount} desired`,
      `Task Definition: ${svc.taskDefinition}`,
      `Launch Type: ${svc.launchType || 'n/a'}`,
      '',
      'Recent Events:',
      ...events,
    ].join('\n');
  }
};
