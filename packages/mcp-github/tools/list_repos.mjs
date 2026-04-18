import { createClient, fmtRepo } from './client.mjs';

export default {
  description: 'List repositories for the authenticated user or an organization.',
  input: {
    org: { type: 'string', description: 'Organization name (optional — omit for your own repos)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true },
    sort: { type: 'string', description: 'Sort by: stars, updated, pushed (default updated)', optional: true }
  },
  execute: async ({ org, limit = 20, sort = 'updated' }, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const path = org
      ? `/orgs/${encodeURIComponent(org)}/repos?per_page=${limit}&sort=${sort}`
      : `/user/repos?per_page=${limit}&sort=${sort}&affiliation=owner,collaborator,organization_member`;
    const repos = await gh('GET', path);
    if (!repos.length) return 'No repositories found.';
    return repos.map(fmtRepo).join('\n');
  }
};
