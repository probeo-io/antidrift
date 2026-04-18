import { createClient } from './client.mjs';

export default {
  description: 'List recent notes/activities for a contact, company, or deal.',
  input: {
    objectType: { type: 'string', description: 'Object type: "contacts", "companies", or "deals"' },
    objectId: { type: 'string', description: 'The record ID' },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ objectType, objectId, limit = 10 }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const assocRes = await hubspot('GET', `/crm/v4/objects/${objectType}/${objectId}/associations/notes`);
    const noteIds = (assocRes.results || []).slice(0, limit).map(r => r.toObjectId);

    if (!noteIds.length) return `No notes found for ${objectType} ${objectId}.`;

    const lines = [];
    for (const noteId of noteIds) {
      try {
        const note = await hubspot('GET', `/crm/v3/objects/notes/${noteId}?properties=hs_note_body,hs_timestamp`);
        const p = note.properties || {};
        const date = p.hs_timestamp ? new Date(p.hs_timestamp).toLocaleDateString() : '';
        const body = (p.hs_note_body || '').replace(/<[^>]+>/g, '').substring(0, 200);
        lines.push(`\uD83D\uDCDD ${date ? `[${date}] ` : ''}${body}  [note id: ${noteId}]`);
      } catch {
        lines.push(`\uD83D\uDCDD [note id: ${noteId}] (could not load)`);
      }
    }
    return lines.join('\n');
  }
};
