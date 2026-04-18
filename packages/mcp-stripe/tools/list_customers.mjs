import { createClient } from './client.mjs';

export default {
  description: 'List Stripe customers. Optional email filter.',
  input: {
    email: { type: 'string', description: 'Filter by email', optional: true },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ email, limit = 10 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const params = { limit };
    if (email) params.email = email;
    const res = await stripe.customers.list(params);
    return res.data.map(c => ({ id: c.id, name: c.name, email: c.email }));
  }
};
