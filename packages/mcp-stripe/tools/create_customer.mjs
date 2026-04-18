import { createClient } from './client.mjs';

export default {
  description: 'Create a new Stripe customer.',
  input: {
    name: { type: 'string', description: 'Customer name', optional: true },
    email: { type: 'string', description: 'Customer email', optional: true },
    description: { type: 'string', description: 'Customer description', optional: true }
  },
  execute: async ({ name, email, description }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const params = {};
    if (name) params.name = name;
    if (email) params.email = email;
    if (description) params.description = description;
    const c = await stripe.customers.create(params);
    return { id: c.id, name: c.name, email: c.email };
  }
};
