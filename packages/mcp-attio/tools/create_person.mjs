import { createClient } from './client.mjs';

export default {
  description: 'Create a new person in Attio.',
  input: {
    email: { type: 'string', description: 'Email address' },
    firstName: { type: 'string', description: 'First name', optional: true },
    lastName: { type: 'string', description: 'Last name', optional: true },
    jobTitle: { type: 'string', description: 'Job title (optional)', optional: true }
  },
  execute: async ({ email, firstName, lastName, jobTitle }, ctx) => {
    const { attio } = createClient(ctx.credentials, ctx.fetch);
    const values = {
      email_addresses: [{ email_address: email }]
    };
    if (firstName || lastName) {
      values.name = [{ first_name: firstName || '', last_name: lastName || '' }];
    }
    if (jobTitle) values.job_title = [{ value: jobTitle }];

    const res = await attio('POST', '/objects/people/records', { data: { values } });
    return `✅ Created ${firstName || ''} ${lastName || ''} (${email})  [id: ${res.data.id.record_id}]`;
  }
};
