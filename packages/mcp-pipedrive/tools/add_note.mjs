import { createClient } from './client.mjs';

export default {
  description: 'Add a note to a deal, person, or organization in Pipedrive.',
  input: {
    content: { type: 'string', description: 'Note content (HTML supported)' },
    dealId: { type: 'number', description: 'Deal ID to attach to', optional: true },
    personId: { type: 'number', description: 'Person ID to attach to', optional: true },
    orgId: { type: 'number', description: 'Organization ID to attach to', optional: true }
  },
  execute: async ({ content, dealId, personId, orgId }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    const body = { content };
    if (dealId) body.deal_id = dealId;
    if (personId) body.person_id = personId;
    if (orgId) body.org_id = orgId;
    const res = await pd('POST', '/notes', body);
    return `Note added  [id: ${res.data.id}]`;
  }
};
