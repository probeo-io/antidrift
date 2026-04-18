import { createClient } from './client.mjs';

export default {
  description: 'List invoices. Optional customer filter.',
  input: {
    customerId: { type: 'string', description: 'Filter by customer ID', optional: true },
    status: { type: 'string', description: 'Filter by status (draft, open, paid, void)', optional: true },
    limit: { type: 'number', description: 'Max results (default 10)', optional: true }
  },
  execute: async ({ customerId, status, limit = 10 }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    const params = { limit };
    if (customerId) params.customer = customerId;
    if (status) params.status = status;
    const res = await stripe.invoices.list(params);
    return res.data.map(i => ({
      id: i.id, status: i.status, total: i.total,
      customer: i.customer, created: new Date(i.created * 1000).toISOString(),
      pdfUrl: i.invoice_pdf
    }));
  }
};
