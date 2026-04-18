import { createClient } from './client.mjs';

export default {
  description: 'Delete a deal from Attio by record ID.',
  input: {
    recordId: { type: 'string', description: 'The deal record ID to delete' }
  },
  execute: async ({ recordId }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    await attio('DELETE', `/objects/deals/records/${recordId}`);
    return `✅ Deal ${recordId} deleted`;
  }
};
