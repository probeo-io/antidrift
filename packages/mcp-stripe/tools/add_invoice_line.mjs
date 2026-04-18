import { createClient } from './client.mjs';

export default {
  description: 'Add a line item to a draft invoice.',
  input: {
    invoiceId: { type: 'string', description: 'Invoice ID' },
    priceId: { type: 'string', description: 'Price ID (for existing products)', optional: true },
    description: { type: 'string', description: 'Line item description (for custom items)', optional: true },
    amount: { type: 'number', description: 'Amount in cents (for custom items)', optional: true },
    quantity: { type: 'number', description: 'Quantity (default 1)', optional: true }
  },
  execute: async ({ invoiceId, priceId, description, amount, quantity = 1 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const params = { invoice: invoiceId, customer: invoice.customer };
    if (priceId) {
      params.price = priceId;
      params.quantity = quantity;
    } else {
      params.description = description;
      params.amount = amount;
      params.currency = 'usd';
    }
    const item = await stripe.invoiceItems.create(params);
    return { id: item.id, amount: item.amount, description: item.description };
  }
};
