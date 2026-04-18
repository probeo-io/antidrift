import { createClient } from './client.mjs';

export default {
  description: 'List prices for a product.',
  input: {
    productId: { type: 'string', description: 'Product ID' }
  },
  execute: async ({ productId }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const res = await stripe.prices.list({ product: productId, active: true });
    return res.data.map(p => ({
      id: p.id, unitAmount: p.unit_amount, currency: p.currency,
      recurring: p.recurring, nickname: p.nickname
    }));
  }
};
