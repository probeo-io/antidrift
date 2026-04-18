import { createClient } from './client.mjs';

export default {
  description: 'Update fields on a person, company, or deal in Attio.',
  input: {
    objectType: { type: 'string', description: 'Object type: "people", "companies", or "deals"' },
    recordId: { type: 'string', description: 'The record ID to update' },
    values: { type: 'object', description: 'Field values to update, e.g. {"job_title": [{"value": "CTO"}]}' }
  },
  execute: async ({ objectType, recordId, values }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('PATCH', `/objects/${objectType}/records/${recordId}`, { data: { values } });
    return `✅ Updated ${objectType} record ${recordId}`;
  }
};
