import { createClient } from './client.mjs';

export default {
  description: 'Get submissions for a form.',
  input: {
    formId: { type: 'string', description: 'The form ID' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ formId, limit = 20 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/form-integrations/v1/submissions/forms/${formId}?limit=${limit}`);
    if (!res.results?.length) return 'No submissions found.';
    return res.results.map((sub, i) => {
      const lines = [`Submission ${i + 1}`];
      if (sub.submittedAt) lines.push(`  Submitted: ${new Date(sub.submittedAt).toLocaleString()}`);
      if (sub.values?.length) {
        for (const v of sub.values) {
          lines.push(`  ${v.name}: ${v.value}`);
        }
      }
      return lines.join('\n');
    }).join('\n\n');
  }
};
