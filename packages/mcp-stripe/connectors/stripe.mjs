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
      const params = { invoice: invoiceId, quantity };
      if (priceId) {
        params.price = priceId;
      } else {
        params.description = description;
        params.price_data = {
          currency: 'usd',
          product_data: { name: description },
          unit_amount: amount
        };
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
  }
];
