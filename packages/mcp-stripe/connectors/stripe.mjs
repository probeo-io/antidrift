import Stripe from 'stripe';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_PATH = join(homedir(), '.antidrift', 'stripe.json');

function getStripe() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`No Stripe config at ${CONFIG_PATH}. Run: npx antidrift mcp add stripe`);
  }
  const { apiKey } = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return new Stripe(apiKey);
}

export const tools = [
  {
    name: 'stripe_list_customers',
    description: 'List Stripe customers. Optional email filter.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Filter by email' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    },
    handler: async ({ email, limit = 10 }) => {
      const params = { limit };
      if (email) params.email = email;
      const res = await getStripe().customers.list(params);
      return res.data.map(c => ({
        id: c.id, name: c.name, email: c.email
      }));
    }
  },
  {
    name: 'stripe_get_customer',
    description: 'Get details for a specific Stripe customer by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Stripe customer ID (cus_...)' }
      },
      required: ['customerId']
    },
    handler: async ({ customerId }) => {
      const c = await getStripe().customers.retrieve(customerId);
      return {
        id: c.id, name: c.name, email: c.email, phone: c.phone,
        description: c.description, created: new Date(c.created * 1000).toISOString(),
        metadata: c.metadata, balance: c.balance, currency: c.currency
      };
    }
  },
  {
    name: 'stripe_create_customer',
    description: 'Create a new Stripe customer.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer name' },
        email: { type: 'string', description: 'Customer email' },
        description: { type: 'string', description: 'Customer description' }
      }
    },
    handler: async ({ name, email, description }) => {
      const params = {};
      if (name) params.name = name;
      if (email) params.email = email;
      if (description) params.description = description;
      const c = await getStripe().customers.create(params);
      return { id: c.id, name: c.name, email: c.email };
    }
  },
  {
    name: 'stripe_update_customer',
    description: 'Update an existing Stripe customer.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Stripe customer ID (cus_...)' },
        name: { type: 'string', description: 'New name' },
        email: { type: 'string', description: 'New email' },
        description: { type: 'string', description: 'New description' }
      },
      required: ['customerId']
    },
    handler: async ({ customerId, name, email, description }) => {
      const params = {};
      if (name !== undefined) params.name = name;
      if (email !== undefined) params.email = email;
      if (description !== undefined) params.description = description;
      const c = await getStripe().customers.update(customerId, params);
      return { id: c.id, name: c.name, email: c.email, description: c.description };
    }
  },
  {
    name: 'stripe_list_products',
    description: 'List Stripe products.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    },
    handler: async ({ limit = 10 }) => {
      const res = await getStripe().products.list({ limit, active: true });
      return res.data.map(p => ({
        id: p.id, name: p.name, description: p.description
      }));
    }
  },
  {
    name: 'stripe_list_prices',
    description: 'List prices for a product.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID' }
      },
      required: ['productId']
    },
    handler: async ({ productId }) => {
      const res = await getStripe().prices.list({ product: productId, active: true });
      return res.data.map(p => ({
        id: p.id, unitAmount: p.unit_amount, currency: p.currency,
        recurring: p.recurring, nickname: p.nickname
      }));
    }
  },
  {
    name: 'stripe_create_invoice',
    description: 'Create a draft invoice for a customer.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Stripe customer ID' },
        description: { type: 'string', description: 'Invoice description' }
      },
      required: ['customerId']
    },
    handler: async ({ customerId, description }) => {
      const invoice = await getStripe().invoices.create({
        customer: customerId,
        description,
        auto_advance: false
      });
      return { id: invoice.id, status: invoice.status, url: invoice.hosted_invoice_url };
    }
  },
  {
    name: 'stripe_add_invoice_line',
    description: 'Add a line item to a draft invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID' },
        priceId: { type: 'string', description: 'Price ID (for existing products)' },
        description: { type: 'string', description: 'Line item description (for custom items)' },
        amount: { type: 'number', description: 'Amount in cents (for custom items)' },
        quantity: { type: 'number', description: 'Quantity (default 1)' }
      },
      required: ['invoiceId']
    },
    handler: async ({ invoiceId, priceId, description, amount, quantity = 1 }) => {
      // Look up the invoice to get the customer
      const invoice = await getStripe().invoices.retrieve(invoiceId);
      const params = { invoice: invoiceId, customer: invoice.customer };
      if (priceId) {
        params.price = priceId;
        params.quantity = quantity;
      } else {
        params.description = description;
        params.amount = amount;
        params.currency = 'usd';
      }
      const item = await getStripe().invoiceItems.create(params);
      return { id: item.id, amount: item.amount, description: item.description };
    }
  },
  {
    name: 'stripe_finalize_invoice',
    description: 'Finalize a draft invoice so it can be paid or downloaded.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoiceId']
    },
    handler: async ({ invoiceId }) => {
      const invoice = await getStripe().invoices.finalizeInvoice(invoiceId);
      return {
        id: invoice.id, status: invoice.status,
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        total: invoice.total
      };
    }
  },
  {
    name: 'stripe_list_invoices',
    description: 'List invoices. Optional customer filter.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Filter by customer ID' },
        status: { type: 'string', description: 'Filter by status (draft, open, paid, void)' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    },
    handler: async ({ customerId, status, limit = 10 }) => {
      const params = { limit };
      if (customerId) params.customer = customerId;
      if (status) params.status = status;
      const res = await getStripe().invoices.list(params);
      return res.data.map(i => ({
        id: i.id, status: i.status, total: i.total,
        customer: i.customer, created: new Date(i.created * 1000).toISOString(),
        pdfUrl: i.invoice_pdf
      }));
    }
  },
  {
    name: 'stripe_send_invoice',
    description: 'Send an open invoice to the customer via email.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoiceId']
    },
    handler: async ({ invoiceId }) => {
      const invoice = await getStripe().invoices.sendInvoice(invoiceId);
      return { id: invoice.id, status: invoice.status, hostedUrl: invoice.hosted_invoice_url };
    }
  },
  {
    name: 'stripe_void_invoice',
    description: 'Void an invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoiceId']
    },
    handler: async ({ invoiceId }) => {
      const invoice = await getStripe().invoices.voidInvoice(invoiceId);
      return { id: invoice.id, status: invoice.status };
    }
  },
  {
    name: 'stripe_list_subscriptions',
    description: 'List subscriptions. Optional customer filter.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Filter by customer ID' },
        status: { type: 'string', description: 'Filter by status (active, past_due, canceled, etc.)' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    },
    handler: async ({ customerId, status, limit = 10 }) => {
      const params = { limit };
      if (customerId) params.customer = customerId;
      if (status) params.status = status;
      const res = await getStripe().subscriptions.list(params);
      return res.data.map(s => ({
        id: s.id, status: s.status, customer: s.customer,
        currentPeriodEnd: new Date(s.current_period_end * 1000).toISOString(),
        items: s.items.data.map(i => ({ priceId: i.price.id, productId: i.price.product, quantity: i.quantity }))
      }));
    }
  },
  {
    name: 'stripe_cancel_subscription',
    description: 'Cancel a subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Subscription ID' },
        atPeriodEnd: { type: 'boolean', description: 'Cancel at end of current period (default true)' }
      },
      required: ['subscriptionId']
    },
    handler: async ({ subscriptionId, atPeriodEnd = true }) => {
      let subscription;
      if (atPeriodEnd) {
        subscription = await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      } else {
        subscription = await getStripe().subscriptions.cancel(subscriptionId);
      }
      return { id: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end };
    }
  },
  {
    name: 'stripe_get_balance',
    description: 'Get the current Stripe account balance.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const balance = await getStripe().balance.retrieve();
      return {
        available: balance.available.map(b => ({ amount: b.amount, currency: b.currency })),
        pending: balance.pending.map(b => ({ amount: b.amount, currency: b.currency }))
      };
    }
  },
  {
    name: 'stripe_list_charges',
    description: 'List charges. Optional customer filter.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Filter by customer ID' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    },
    handler: async ({ customerId, limit = 10 }) => {
      const params = { limit };
      if (customerId) params.customer = customerId;
      const res = await getStripe().charges.list(params);
      return res.data.map(c => ({
        id: c.id, amount: c.amount, currency: c.currency,
        status: c.status, customer: c.customer,
        description: c.description,
        created: new Date(c.created * 1000).toISOString()
      }));
    }
  },
  {
    name: 'stripe_create_payment_link',
    description: 'Create a payment link for a price.',
    inputSchema: {
      type: 'object',
      properties: {
        priceId: { type: 'string', description: 'Price ID' },
        quantity: { type: 'number', description: 'Quantity (default 1)' }
      },
      required: ['priceId']
    },
    handler: async ({ priceId, quantity = 1 }) => {
      const link = await getStripe().paymentLinks.create({
        line_items: [{ price: priceId, quantity }]
      });
      return { id: link.id, url: link.url, active: link.active };
    }
  }
];
