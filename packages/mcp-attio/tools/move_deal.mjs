import { createClient } from './client.mjs';

export default {
  description: 'Move a deal to a different pipeline stage in Attio.',
  input: {
    recordId: { type: 'string', description: 'The deal record ID' },
    stage: { type: 'string', description: 'The stage name to move to (e.g. "Qualified", "Proposal", "Closed Won")' }
  },
  execute: async ({ recordId, stage }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('PATCH', `/objects/deals/records/${recordId}`, {
      data: { values: { stage: [{ status: { title: stage } }] } }
    });
    return `✅ Deal moved to "${stage}"`;
  }
};
