import { createClient } from './client.mjs';

export default {
  description: 'Send an open invoice to the customer via email.',
  input: {
    invoiceId: { type: 'string', description: 'Invoice ID' }
  },
  execute: async ({ invoiceId }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const invoice = await stripe.invoices.sendInvoice(invoiceId);
    return { id: invoice.id, status: invoice.status, hostedUrl: invoice.hosted_invoice_url };
  }
};
