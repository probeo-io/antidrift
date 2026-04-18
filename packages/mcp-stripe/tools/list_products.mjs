import { createClient } from './client.mjs';

export default {
  description: 'List Stripe products.',
  input: {
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ limit = 10 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const res = await stripe.products.list({ limit, active: true });
    return res.data.map(p => ({ id: p.id, name: p.name, description: p.description }));
  }
};
