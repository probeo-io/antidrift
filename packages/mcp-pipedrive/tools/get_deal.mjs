import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a deal by ID.',
  input: {
    id: { type: 'number', description: 'Deal ID' }
  },
  execute: async ({ id }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const res = await pd('GET', `/deals/${id}`);
    const d = res.data;
    const lines = [];
    lines.push(`${d.title}  [${d.status}]`);
    if (d.value) lines.push(`Value: $${d.value} ${d.currency || ''}`);
    if (d.person_name) lines.push(`Contact: ${d.person_name}`);
    if (d.org_name) lines.push(`Organization: ${d.org_name}`);
    if (d.pipeline_id) lines.push(`Pipeline: ${d.pipeline_id}`);
    if (d.stage_id) lines.push(`Stage: ${d.stage_id}`);
    if (d.expected_close_date) lines.push(`Expected close: ${d.expected_close_date}`);
    if (d.owner_name) lines.push(`Owner: ${d.owner_name}`);
    lines.push(`Created: ${d.add_time}`);
    lines.push(`[id: ${d.id}]`);
    return lines.join('\n');
  }
};
