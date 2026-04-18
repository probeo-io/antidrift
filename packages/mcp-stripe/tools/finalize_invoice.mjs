import { createClient } from './client.mjs';

export default {
  description: 'Finalize a draft invoice so it can be paid or downloaded.',
  input: {
    invoiceId: { type: 'string', description: 'Invoice ID' }
  },
  execute: async ({ invoiceId }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const invoice = await stripe.invoices.finalizeInvoice(invoiceId);
    return {
      id: invoice.id, status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      total: invoice.total
    };
  }
};
