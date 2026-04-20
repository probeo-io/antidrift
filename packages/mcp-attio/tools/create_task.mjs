import { createClient } from './client.mjs';

export default {
  description: 'Create a task in Attio, optionally linked to a record.',
  input: {
    content: { type: 'string', description: 'Task description' },
    deadlineAt: { type: 'string', description: 'Deadline as ISO date string (optional)', optional: true },
    assignees: { type: 'string', description: 'Comma-separated workspace member IDs to assign (optional)', optional: true },
    linkedRecordId: { type: 'string', description: 'Record ID to link the task to (optional)', optional: true },
    linkedObjectType: { type: 'string', description: 'Object type of linked record: "people", "companies", or "deals" (optional)', optional: true }
  },
  execute: async ({ content, deadlineAt, assignees, linkedRecordId, linkedObjectType }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const body = {
      data: {
        content,
        format: 'plaintext',
        is_completed: false,
        deadline_at: deadlineAt || null,
        linked_records: (linkedRecordId && linkedObjectType) ? [{ target_object: linkedObjectType, target_record_id: linkedRecordId }] : [],
        assignees: assignees ? assignees.split(',').map(id => ({ referenced_actor_type: 'workspace-member', referenced_actor_id: id.trim() })) : []
      }
    };
    const res = await attio('POST', '/tasks', body);
    return `✅ Task created: "${content}"${deadlineAt ? ` (due: ${deadlineAt})` : ''}`;
  }
};
