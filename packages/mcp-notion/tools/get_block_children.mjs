import { createClient, formatBlock } from './client.mjs';

export default {
  description: 'Get children of a block in Notion.',
  input: {
    blockId: { type: 'string', description: 'The block ID' }
  },
  execute: async ({ blockId }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const blocks = await fetchAllChildren(blockId);
    if (!blocks.length) return 'No child blocks found.';
    return blocks.map(b => formatBlock(b)).join('\n');
  }
};
