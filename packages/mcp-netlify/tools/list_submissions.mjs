import { createClient } from './client.mjs';

export default {
  description: 'List form submissions.',
  input: {
    formId: { type: 'string', description: 'Form ID' },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ formId, limit = 20 }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    const res = await nf('GET', `/forms/${formId}/submissions?per_page=${limit}`);
    if (!res.length) return 'No submissions found.';
    return res.map(s => {
      const data = s.data || {};
      const fields = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ');
      return `${new Date(s.created_at).toLocaleString()}  ${fields}`;
    }).join('\n');
  }
};
