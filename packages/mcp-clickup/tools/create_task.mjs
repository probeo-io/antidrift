import { createClient } from './client.mjs';

export default {
  description: 'Create a new task in a ClickUp list.',
  input: {
    listId: { type: 'string', description: 'The list ID to create the task in' },
    name: { type: 'string', description: 'Task name' },
    description: { type: 'string', description: 'Task description (optional)', optional: true },
    priority: { type: 'number', description: 'Priority: 1=urgent, 2=high, 3=normal, 4=low (optional)', optional: true },
    assignees: { type: 'array', items: { type: 'number' }, description: 'Array of assignee user IDs (optional)', optional: true },
    dueDate: { type: 'string', description: 'Due date as ISO string or unix ms (optional)', optional: true },
    tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names (optional)', optional: true }
  },
  execute: async ({ listId, name, description, priority, assignees, dueDate, tags }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const body = { name };
    if (description) body.description = description;
    if (priority) body.priority = priority;
    if (assignees?.length) body.assignees = assignees;
    if (dueDate) {
      body.due_date = typeof dueDate === 'string' && dueDate.includes('-')
        ? new Date(dueDate).getTime()
        : parseInt(dueDate);
    }
    if (tags?.length) body.tags = tags;

    const res = await clickup('POST', `/list/${listId}/task`, body);
    return `\u2705 Created task: "${res.name}"  [id: ${res.id}]`;
  }
};
