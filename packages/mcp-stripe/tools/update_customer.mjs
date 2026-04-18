import { createClient } from './client.mjs';

export default {
  description: 'Update an existing Stripe customer.',
  input: {
    customerId: { type: 'string', description: 'Stripe customer ID (cus_...)' },
    name: { type: 'string', description: 'New name', optional: true },
    email: { type: 'string', description: 'New email', optional: true },
    description: { type: 'string', description: 'New description', optional: true }
  },
  execute: async ({ customerId, name, email, description }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const params = {};
    if (name !== undefined) params.name = name;
    if (email !== undefined) params.email = email;
    if (description !== undefined) params.description = description;
    const c = await stripe.customers.update(customerId, params);
    return { id: c.id, name: c.name, email: c.email, description: c.description };
  }
};
