import { createClient } from './client.mjs';

export default {
  description: 'Void an invoice.',
  input: {
    invoiceId: { type: 'string', description: 'Invoice ID' }
  },
  execute: async ({ invoiceId }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const invoice = await stripe.invoices.voidInvoice(invoiceId);
    return { id: invoice.id, status: invoice.status };
  }
};
