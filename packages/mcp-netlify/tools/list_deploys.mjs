import { createClient } from './client.mjs';

export default {
  description: 'List recent deploys for a site.',
  input: {
    siteId: { type: 'string', description: 'Site ID' },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ siteId, limit = 10 }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('GET', `/sites/${encodeURIComponent(siteId)}/deploys?per_page=${limit}`);
    if (!res.length) return 'No deploys found.';
    return res.map(d => {
      let line = `${d.id.slice(0, 8)}  [${d.state}]`;
      if (d.branch) line += `  ${d.branch}`;
      if (d.title) line += `  "${d.title.slice(0, 60)}"`;
      if (d.deploy_time) line += `  ${d.deploy_time}s`;
      line += `  ${new Date(d.created_at).toLocaleString()}`;
      return line;
    }).join('\n');
  }
};
