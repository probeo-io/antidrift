import { createClient } from './client.mjs';

export default {
  description: 'Update a deal in Pipedrive.',
  input: {
    id: { type: 'number', description: 'Deal ID' },
    title: { type: 'string', description: 'New title', optional: true },
    value: { type: 'number', description: 'New value', optional: true },
    status: { type: 'string', description: 'Status: open, won, lost', optional: true },
    stageId: { type: 'number', description: 'Stage ID to move to', optional: true }
  },
  execute: async ({ id, title, value, status, stageId }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const body = {};
    if (title) body.title = title;
    if (value) body.value = value;
    if (status) body.status = status;
    if (stageId) body.stage_id = stageId;
    const res = await pd('PUT', `/deals/${id}`, body);
    return `Updated deal: ${res.data.title}  [id: ${res.data.id}]`;
  }
};
