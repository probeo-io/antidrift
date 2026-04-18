import { createClient } from './client.mjs';

export default {
  description: 'List all sites in your Netlify account.',
  input: {
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ limit = 20 }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('GET', `/sites?per_page=${limit}`);
    if (!res.length) return 'No sites found.';
    return res.map(s => {
      let line = `${s.name}`;
      if (s.ssl_url) line += `  ${s.ssl_url}`;
      if (s.published_deploy?.branch) line += `  [${s.published_deploy.branch}]`;
      line += `  [id: ${s.id}]`;
      return line;
    }).join('\n');
  }
};
