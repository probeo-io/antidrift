import { createClient } from './client.mjs';

export default {
  description: 'Add a note to a person or company in Attio.',
  input: {
    objectType: { type: 'string', description: 'Object type: "people" or "companies"' },
    recordId: { type: 'string', description: 'The record ID' },
    title: { type: 'string', description: 'Note title' },
    content: { type: 'string', description: 'Note content' }
  },
  execute: async ({ objectType, recordId, title, content }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const res = await attio('POST', '/notes', {
      data: {
        title,
        content,
        format: 'plaintext',
        parent_object: objectType === 'people' ? 'people' : 'companies',
        parent_record_id: recordId
      }
    });
    return `✅ Note added: "${title}"`;
  }
};
