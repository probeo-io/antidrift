import { createClient } from './client.mjs';

export default {
  description: 'Create a new deal in Attio.',
  input: {
    name: { type: 'string', description: 'Deal name' },
    stage: { type: 'string', description: 'Pipeline stage (e.g. "Qualified", "Proposal", "Closed Won")', optional: true },
    value: { type: 'number', description: 'Deal value in currency units (optional)', optional: true },
    linkedCompanyId: { type: 'string', description: 'Company record ID to associate with the deal (optional)', optional: true }
  },
  execute: async ({ name, stage, value, linkedCompanyId }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const values = { name: [{ value: name }] };
    if (stage) values.stage = [{ status: stage }];
    if (value != null) values.value = [{ currency_value: value }];
    if (linkedCompanyId) values.associated_company = [{ target_object: 'companies', target_record_id: linkedCompanyId }];

    const res = await attio('POST', '/objects/deals/records', { data: { values } });
    return `✅ Created deal "${name}"  [id: ${res.data.id.record_id}]`;
  }
};
