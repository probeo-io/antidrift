import { createClient, getPageTitle, formatProperties } from './client.mjs';

export default {
  description: 'Query a Notion database. Returns pages matching the filter.',
  input: {
    databaseId: { type: 'string', description: 'The database ID' },
    filter: { type: 'object', description: 'Notion filter object (optional)', optional: true },
    sorts: { type: 'array', description: 'Notion sorts array (optional)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ databaseId, filter, sorts, limit = 20 }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const body = { page_size: Math.min(limit, 100) };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    const res = await notion('POST', `/databases/${databaseId}/query`, body);
    if (!res.results?.length) return 'No results found.';
    return res.results.map(page => {
      const title = getPageTitle(page);
      const props = formatProperties(page.properties);
      return [`\uD83D\uDCC4 ${title} [id: ${page.id}]`, ...props].join('\n');
    }).join('\n\n');
  }
};
