import { createClient } from './client.mjs';

export default {
  description: 'Create a task in Attio, optionally linked to a record.',
  input: {
    content: { type: 'string', description: 'Task description' },
    deadlineAt: { type: 'string', description: 'Deadline as ISO date string (optional)', optional: true },
    linkedRecordId: { type: 'string', description: 'Record ID to link the task to (optional)', optional: true },
    linkedObjectType: { type: 'string', description: 'Object type of linked record: "people", "companies", or "deals" (optional)', optional: true }
  },
  execute: async ({ content, deadlineAt, linkedRecordId, linkedObjectType }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const body = {
      data: {
        content: [{ type: 'paragraph', children: [{ text: content }] }],
        format: 'plaintext',
        is_completed: false
      }
    };
    if (deadlineAt) body.data.deadline_at = deadlineAt;
    if (linkedRecordId && linkedObjectType) {
      body.data.linked_records = [{ target_object: linkedObjectType, target_record_id: linkedRecordId }];
    }
    const res = await attio('POST', '/tasks', body);
    return `✅ Task created: "${content}"${deadlineAt ? ` (due: ${deadlineAt})` : ''}`;
  }
};
