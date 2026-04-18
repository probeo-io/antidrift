import { createClient } from './client.mjs';

export default {
  description: 'List forms for a site.',
  input: {
    siteId: { type: 'string', description: 'Site ID' }
  },
  execute: async ({ siteId }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('GET', `/sites/${encodeURIComponent(siteId)}/forms`);
    if (!res.length) return 'No forms found.';
    return res.map(f => `${f.name}  (${f.submission_count} submissions)  [id: ${f.id}]`).join('\n');
  }
};
