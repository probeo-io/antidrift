import { createClient } from './client.mjs';

export default {
  description: 'List charges. Optional customer filter.',
  input: {
    customerId: { type: 'string', description: 'Filter by customer ID', optional: true },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ customerId, limit = 10 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const params = { limit };
    if (customerId) params.customer = customerId;
    const res = await stripe.charges.list(params);
    return res.data.map(c => ({
      id: c.id, amount: c.amount, currency: c.currency,
      status: c.status, customer: c.customer,
      description: c.description,
      created: new Date(c.created * 1000).toISOString()
    }));
  }
};
