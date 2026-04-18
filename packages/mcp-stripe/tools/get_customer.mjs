import { createClient } from './client.mjs';

export default {
  description: 'Get details for a specific Stripe customer by ID.',
  input: {
    customerId: { type: 'string', description: 'Stripe customer ID (cus_...)' }
  },
  execute: async ({ customerId }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const c = await stripe.customers.retrieve(customerId);
    return {
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      description: c.description, created: new Date(c.created * 1000).toISOString(),
      metadata: c.metadata, balance: c.balance, currency: c.currency
    };
  }
};
