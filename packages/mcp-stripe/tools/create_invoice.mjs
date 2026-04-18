import { createClient } from './client.mjs';

export default {
  description: 'Create a draft invoice for a customer.',
  input: {
    customerId: { type: 'string', description: 'Stripe customer ID' },
    description: { type: 'string', description: 'Invoice description', optional: true }
  },
  execute: async ({ customerId, description }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const invoice = await stripe.invoices.create({
      customer: customerId,
      description,
      auto_advance: false
    });
    return { id: invoice.id, status: invoice.status, url: invoice.hosted_invoice_url };
  }
};
