import { createClient } from './client.mjs';

export default {
  description: 'Create an activity (call, meeting, task) in Pipedrive.',
  input: {
    subject: { type: 'string', description: 'Activity subject' },
    type: { type: 'string', description: 'Type: call, meeting, task, email, lunch, deadline' },
    dueDate: { type: 'string', description: 'Due date (YYYY-MM-DD)', optional: true },
    dealId: { type: 'number', description: 'Link to deal ID', optional: true },
    personId: { type: 'number', description: 'Link to person ID', optional: true }
  },
  execute: async ({ subject, type, dueDate, dealId, personId }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const body = { subject, type };
    if (dueDate) body.due_date = dueDate;
    if (dealId) body.deal_id = dealId;
    if (personId) body.person_id = personId;
    const res = await pd('POST', '/activities', body);
    return `Created ${type}: ${subject}  [id: ${res.data.id}]`;
  }
};
