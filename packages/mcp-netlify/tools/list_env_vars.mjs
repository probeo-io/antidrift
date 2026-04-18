import { createClient } from './client.mjs';

export default {
  description: 'List environment variables for a site.',
  input: {
    accountId: { type: 'string', description: 'Account/team slug (from your Netlify URL)' },
    siteId: { type: 'string', description: 'Site ID to filter by (optional)', optional: true }
  },
  execute: async ({ accountId, siteId }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    let path = `/accounts/${encodeURIComponent(accountId)}/env`;
    if (siteId) path += `?site_id=${encodeURIComponent(siteId)}`;
    const res = await nf('GET', path);
    if (!res.length) return 'No environment variables found.';
    return res.map(e => {
      const contexts = e.values?.map(v => v.context).join(', ') || 'all';
      return `${e.key}  [${contexts}]`;
    }).join('\n');
  }
};
