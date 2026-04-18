import { createClient } from './client.mjs';

export default {
  description: 'Rollback to a previous deploy.',
  input: {
    siteId: { type: 'string', description: 'Site ID' },
    deployId: { type: 'string', description: 'Deploy ID to restore' }
  },
  execute: async ({ siteId, deployId }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('POST', `/sites/${encodeURIComponent(siteId)}/deploys/${deployId}/restore`);
    return `Rolled back to deploy ${deployId}  [${res.state}]`;
  }
};
