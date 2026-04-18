import { createClient } from './client.mjs';

export default {
  description: 'Get the current Stripe account balance.',
  input: {},
  execute: async (_args, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const balance = await stripe.balance.retrieve();
    return {
      available: balance.available.map(b => ({ amount: b.amount, currency: b.currency })),
      pending: balance.pending.map(b => ({ amount: b.amount, currency: b.currency }))
    };
  }
};
