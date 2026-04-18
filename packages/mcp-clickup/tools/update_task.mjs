import { createClient } from './client.mjs';

export default {
  description: 'Update a ClickUp task (name, description, status, priority, assignees, due date).',
  input: {
    taskId: { type: 'string', description: 'The task ID' },
    name: { type: 'string', description: 'New task name (optional)', optional: true },
    description: { type: 'string', description: 'New description (optional)', optional: true },
    status: { type: 'string', description: 'New status name (optional)', optional: true },
    priority: { type: 'number', description: 'Priority: 1=urgent, 2=high, 3=normal, 4=low (optional)', optional: true },
    assignees: { type: 'object', description: 'Assignees object with "add" and/or "rem" arrays of user IDs (optional)', optional: true },
    dueDate: { type: 'string', description: 'Due date as ISO string or unix ms (optional)', optional: true }
  },
  execute: async ({ taskId, name, description, status, priority, assignees, dueDate }, ctx) => {
    const { clickup } = createClient(ctx.credentials, ctx.fetch);
    const body = {};
    if (name) body.name = name;
    if (description) body.description = description;
    if (status) body.status = status;
    if (priority) body.priority = priority;
    if (assignees) body.assignees = assignees;
    if (dueDate) {
      body.due_date = typeof dueDate === 'string' && dueDate.includes('-')
        ? new Date(dueDate).getTime()
        : parseInt(dueDate);
    }

    await clickup('PUT', `/task/${taskId}`, body);
    return `\u2705 Task ${taskId} updated`;
  }
};
