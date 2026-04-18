import { createClient } from './client.mjs';

export default {
  description: 'Trigger a redeployment of the latest production deployment.',
  input: {
    deploymentId: { type: 'string', description: 'Deployment ID to redeploy' }
  },
  execute: async ({ deploymentId }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('POST', `/v13/deployments?forceNew=1`, {
      deploymentId,
      target: 'production'
    });
    return `Redeployment triggered: ${res.url}  [${res.readyState}]`;
  }
};
