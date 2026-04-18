import { createClient } from './client.mjs';

export default {
  description: 'Get build logs/events for a deployment.',
  input: {
    deploymentId: { type: 'string', description: 'Deployment ID' }
  },
  execute: async ({ deploymentId }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const res = await vc('GET', `/v3/deployments/${encodeURIComponent(deploymentId)}/events`);
    if (!res.length) return 'No events found.';
    return res.slice(-30).map(e => {
      const time = e.created ? new Date(e.created).toLocaleTimeString() : '';
      return `${time}  ${e.text || e.payload?.text || JSON.stringify(e)}`;
    }).join('\n');
  }
};
