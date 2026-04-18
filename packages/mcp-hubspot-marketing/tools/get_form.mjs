import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a form by ID.',
  input: {
    formId: { type: 'string', description: 'The form ID' }
  },
  execute: async ({ formId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/marketing/v3/forms/${formId}`);
    const lines = [];
    lines.push(`\uD83D\uDCCB ${res.name || 'Untitled'}`);
    if (res.formType) lines.push(`Type: ${res.formType}`);
    if (res.createdAt) lines.push(`Created: ${res.createdAt}`);
    if (res.updatedAt) lines.push(`Updated: ${res.updatedAt}`);
    if (res.fieldGroups?.length) {
      lines.push(`Fields: ${res.fieldGroups.length} group(s)`);
    }
    lines.push(`[id: ${formId}]`);
    return lines.join('\n');
  }
};
