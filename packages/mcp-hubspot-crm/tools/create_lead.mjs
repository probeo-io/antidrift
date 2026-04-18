import { createClient } from './client.mjs';

export default {
  description: 'Create a new lead in HubSpot CRM.',
  input: {
    email: { type: 'string', description: 'Email address' },
    firstName: { type: 'string', description: 'First name', optional: true },
    lastName: { type: 'string', description: 'Last name', optional: true },
    phone: { type: 'string', description: 'Phone number (optional)', optional: true },
    company: { type: 'string', description: 'Company name (optional)', optional: true }
  },
  execute: async ({ email, firstName, lastName, phone, company }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const properties = { email };
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;
    if (phone) properties.phone = phone;
    if (company) properties.company = company;

    const res = await hubspot('POST', '/crm/v3/objects/leads', { properties });
    return `\u2705 Created lead ${firstName || ''} ${lastName || ''} (${email})  [id: ${res.id}]`;
  }
};
