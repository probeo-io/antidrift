import { createClient } from './client.mjs';

export default {
  description: 'List subscriptions. Optional customer filter.',
  input: {
    customerId: { type: 'string', description: 'Filter by customer ID', optional: true },
    status: { type: 'string', description: 'Filter by status (active, past_due, canceled, etc.)', optional: true },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ customerId, status, limit = 10 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const params = { limit };
    if (customerId) params.customer = customerId;
    if (status) params.status = status;
    const res = await stripe.subscriptions.list(params);
    return res.data.map(s => ({
      id: s.id, status: s.status, customer: s.customer,
      currentPeriodEnd: new Date(s.current_period_end * 1000).toISOString(),
      items: s.items.data.map(i => ({ priceId: i.price.id, productId: i.price.product, quantity: i.quantity }))
    }));
  }
};
