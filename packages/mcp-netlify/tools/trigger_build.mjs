import { createClient } from './client.mjs';

export default {
  description: 'Trigger a new build for a site.',
  input: {
    siteId: { type: 'string', description: 'Site ID' }
  },
  execute: async ({ siteId }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('POST', `/sites/${encodeURIComponent(siteId)}/builds`);
    return `Build triggered  [id: ${res.id}]  [${res.done ? 'done' : 'building'}]`;
  }
};
