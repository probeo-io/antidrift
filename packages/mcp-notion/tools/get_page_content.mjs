import { createClient, getPageTitle } from './client.mjs';

export default {
  description: 'Get page content (blocks) from Notion. Recursively fetches child blocks.',
  input: {
    pageId: { type: 'string', description: 'The page ID' }
  },
  execute: async ({ pageId }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const page = await notion('GET', `/pages/${pageId}`);
    const title = getPageTitle(page);
    const lines = [`\uD83D\uDCC4 ${title}`, ''];
    const contentLines = await fetchBlocksRecursive(pageId);
    lines.push(...contentLines);
    return lines.join('\n');
  }
};
