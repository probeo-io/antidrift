import { createClient } from './client.mjs';

export default {
  description: 'Create a payment link for a price.',
  input: {
    priceId: { type: 'string', description: 'Price ID' },
    quantity: { type: 'number', description: 'Quantity (default 1)', optional: true }
  },
  execute: async ({ priceId, quantity = 1 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: priceId, quantity }]
    });
    return { id: link.id, url: link.url, active: link.active };
  }
};
