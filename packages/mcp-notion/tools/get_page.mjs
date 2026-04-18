import { createClient, getPageTitle, formatProperties } from './client.mjs';

export default {
  description: 'Get page properties from Notion.',
  input: {
    pageId: { type: 'string', description: 'The page ID' }
  },
  execute: async ({ pageId }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const page = await notion('GET', `/pages/${pageId}`);
    const title = getPageTitle(page);
    const lines = [`\uD83D\uDCC4 ${title} [id: ${page.id}]`, ''];
    lines.push(...formatProperties(page.properties));
    if (page.url) lines.push(`  URL: ${page.url}`);
    return lines.join('\n');
  }
};
