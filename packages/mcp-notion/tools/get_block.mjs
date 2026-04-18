import { createClient, formatBlock } from './client.mjs';

export default {
  description: 'Get a specific block from Notion.',
  input: {
    blockId: { type: 'string', description: 'The block ID' }
  },
  execute: async ({ blockId }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const block = await notion('GET', `/blocks/${blockId}`);
    return formatBlock(block);
  }
};
