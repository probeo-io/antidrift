import { createClient } from './client.mjs';

export default {
  description: 'Add a note to a contact, company, or deal in HubSpot.',
  input: {
    objectType: { type: 'string', description: 'Object type: "contacts", "companies", or "deals"' },
    objectId: { type: 'string', description: 'The record ID to attach the note to' },
    body: { type: 'string', description: 'Note content' }
  },
  execute: async ({ objectType, objectId, body }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const noteRes = await hubspot('POST', '/crm/v3/objects/notes', {
      properties: {
        hs_note_body: body,
        hs_timestamp: new Date().toISOString()
      }
    });
    const noteId = noteRes.id;

    await hubspot('PUT', `/crm/v4/objects/notes/${noteId}/associations/${objectType}/${objectId}`, [
      { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: objectType === 'contacts' ? 202 : objectType === 'companies' ? 190 : 214 }
    ]);

    return `\u2705 Note added to ${objectType} ${objectId}  [note id: ${noteId}]`;
  }
};
