import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'stripe.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

// ---------------------------------------------------------------------------
// Mock Stripe SDK
// ---------------------------------------------------------------------------
let mockStripe;

await mock.module('stripe', {
  defaultExport: class FakeStripe {
    constructor() { return mockStripe; }
  }
});

let tools, toolMap;

before(() => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey: 'sk_test_fake' }));
});

// We need to import after writing config since getStripe() reads it synchronously
before(async () => {
  const mod = await import('../connectors/stripe.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
});

afterEach(() => {
  mockStripe = {};
});

// Restore config after all tests
after(() => {
  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  }
});

import { after } from 'node:test';

function getTool(name) { return toolMap[name]; }

// ---------------------------------------------------------------------------
// stripe_list_customers
// ---------------------------------------------------------------------------
describe('stripe_list_customers handler', () => {
  it('returns customer list', async () => {
    mockStripe = {
      customers: {
        list: async () => ({ data: [
          { id: 'cus_1', name: 'Alice', email: 'alice@test.com' },
          { id: 'cus_2', name: 'Bob', email: 'bob@test.com' },
        ] })
      }
    };
    const result = await getTool('stripe_list_customers').handler({});
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'cus_1');
    assert.equal(result[0].name, 'Alice');
  });

  it('passes email filter', async () => {
    let captured;
    mockStripe = {
      customers: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_customers').handler({ email: 'alice@test.com', limit: 5 });
    assert.equal(captured.email, 'alice@test.com');
    assert.equal(captured.limit, 5);
  });
});

// ---------------------------------------------------------------------------
// stripe_get_customer
// ---------------------------------------------------------------------------
describe('stripe_get_customer handler', () => {
  it('returns customer details', async () => {
    mockStripe = {
      customers: {
        retrieve: async () => ({
          id: 'cus_1', name: 'Alice', email: 'alice@test.com', phone: '+1234',
          description: 'VIP', created: 1700000000, metadata: {}, balance: 0, currency: 'usd'
        })
      }
    };
    const result = await getTool('stripe_get_customer').handler({ customerId: 'cus_1' });
    assert.equal(result.id, 'cus_1');
    assert.equal(result.name, 'Alice');
    assert.ok(result.created);
  });
});

// ---------------------------------------------------------------------------
// stripe_create_customer
// ---------------------------------------------------------------------------
describe('stripe_create_customer handler', () => {
  it('creates customer and returns data', async () => {
    let captured;
    mockStripe = {
      customers: {
        create: async (params) => { captured = params; return { id: 'cus_3', name: 'Carol', email: 'carol@test.com' }; }
      }
    };
    const result = await getTool('stripe_create_customer').handler({ name: 'Carol', email: 'carol@test.com' });
    assert.equal(result.id, 'cus_3');
    assert.equal(captured.name, 'Carol');
    assert.equal(captured.email, 'carol@test.com');
  });
});

// ---------------------------------------------------------------------------
// stripe_update_customer
// ---------------------------------------------------------------------------
describe('stripe_update_customer handler', () => {
  it('updates customer and returns data', async () => {
    let capturedId, capturedParams;
    mockStripe = {
      customers: {
        update: async (id, params) => { capturedId = id; capturedParams = params; return { id, name: 'Alice New', email: 'alice@new.com', description: 'Updated' }; }
      }
    };
    const result = await getTool('stripe_update_customer').handler({ customerId: 'cus_1', name: 'Alice New', email: 'alice@new.com' });
    assert.equal(capturedId, 'cus_1');
    assert.equal(capturedParams.name, 'Alice New');
    assert.equal(result.name, 'Alice New');
  });
});

// ---------------------------------------------------------------------------
// stripe_list_products
// ---------------------------------------------------------------------------
describe('stripe_list_products handler', () => {
  it('returns products', async () => {
    mockStripe = {
      products: {
        list: async () => ({ data: [
          { id: 'prod_1', name: 'Widget', description: 'A widget' }
        ] })
      }
    };
    const result = await getTool('stripe_list_products').handler({});
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Widget');
  });

  it('passes limit and active filter', async () => {
    let captured;
    mockStripe = {
      products: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_products').handler({ limit: 5 });
    assert.equal(captured.limit, 5);
    assert.equal(captured.active, true);
  });
});

// ---------------------------------------------------------------------------
// stripe_list_prices
// ---------------------------------------------------------------------------
describe('stripe_list_prices handler', () => {
  it('returns prices for product', async () => {
    let captured;
    mockStripe = {
      prices: {
        list: async (params) => {
          captured = params;
          return { data: [
            { id: 'price_1', unit_amount: 1000, currency: 'usd', recurring: null, nickname: 'Basic' }
          ] };
        }
      }
    };
    const result = await getTool('stripe_list_prices').handler({ productId: 'prod_1' });
    assert.equal(captured.product, 'prod_1');
    assert.equal(result[0].unitAmount, 1000);
  });
});

// ---------------------------------------------------------------------------
// stripe_create_invoice
// ---------------------------------------------------------------------------
describe('stripe_create_invoice handler', () => {
  it('creates invoice and returns data', async () => {
    let captured;
    mockStripe = {
      invoices: {
        create: async (params) => { captured = params; return { id: 'in_1', status: 'draft', hosted_invoice_url: null }; }
      }
    };
    const result = await getTool('stripe_create_invoice').handler({ customerId: 'cus_1', description: 'Q1' });
    assert.equal(result.id, 'in_1');
    assert.equal(result.status, 'draft');
    assert.equal(captured.customer, 'cus_1');
    assert.equal(captured.description, 'Q1');
    assert.equal(captured.auto_advance, false);
  });
});

// ---------------------------------------------------------------------------
// stripe_add_invoice_line
// ---------------------------------------------------------------------------
describe('stripe_add_invoice_line handler', () => {
  it('adds line item with priceId', async () => {
    let captured;
    mockStripe = {
      invoices: { retrieve: async () => ({ customer: 'cus_1' }) },
      invoiceItems: {
        create: async (params) => { captured = params; return { id: 'ii_1', amount: 1000, description: 'Widget' }; }
      }
    };
    const result = await getTool('stripe_add_invoice_line').handler({ invoiceId: 'in_1', priceId: 'price_1', quantity: 2 });
    assert.equal(captured.price, 'price_1');
    assert.equal(captured.quantity, 2);
    assert.equal(captured.invoice, 'in_1');
    assert.equal(result.id, 'ii_1');
  });

  it('adds custom line item with amount', async () => {
    let captured;
    mockStripe = {
      invoices: { retrieve: async () => ({ customer: 'cus_1' }) },
      invoiceItems: {
        create: async (params) => { captured = params; return { id: 'ii_2', amount: 5000, description: 'Custom work' }; }
      }
    };
    await getTool('stripe_add_invoice_line').handler({ invoiceId: 'in_1', description: 'Custom work', amount: 5000 });
    assert.equal(captured.amount, 5000);
    assert.equal(captured.description, 'Custom work');
    assert.equal(captured.currency, 'usd');
  });
});

// ---------------------------------------------------------------------------
// stripe_finalize_invoice
// ---------------------------------------------------------------------------
describe('stripe_finalize_invoice handler', () => {
  it('finalizes and returns invoice data', async () => {
    mockStripe = {
      invoices: {
        finalizeInvoice: async () => ({
          id: 'in_1', status: 'open', invoice_pdf: 'https://pdf', hosted_invoice_url: 'https://hosted', total: 5000
        })
      }
    };
    const result = await getTool('stripe_finalize_invoice').handler({ invoiceId: 'in_1' });
    assert.equal(result.status, 'open');
    assert.equal(result.pdfUrl, 'https://pdf');
    assert.equal(result.total, 5000);
  });
});

// ---------------------------------------------------------------------------
// stripe_list_invoices
// ---------------------------------------------------------------------------
describe('stripe_list_invoices handler', () => {
  it('returns invoices with filters', async () => {
    let captured;
    mockStripe = {
      invoices: {
        list: async (params) => {
          captured = params;
          return { data: [
            { id: 'in_1', status: 'open', total: 5000, customer: 'cus_1', created: 1700000000, invoice_pdf: 'https://pdf' }
          ] };
        }
      }
    };
    const result = await getTool('stripe_list_invoices').handler({ customerId: 'cus_1', status: 'open' });
    assert.equal(captured.customer, 'cus_1');
    assert.equal(captured.status, 'open');
    assert.equal(result[0].id, 'in_1');
  });
});

// ---------------------------------------------------------------------------
// stripe_send_invoice
// ---------------------------------------------------------------------------
describe('stripe_send_invoice handler', () => {
  it('sends invoice', async () => {
    mockStripe = {
      invoices: {
        sendInvoice: async () => ({ id: 'in_1', status: 'open', hosted_invoice_url: 'https://hosted' })
      }
    };
    const result = await getTool('stripe_send_invoice').handler({ invoiceId: 'in_1' });
    assert.equal(result.id, 'in_1');
    assert.equal(result.hostedUrl, 'https://hosted');
  });
});

// ---------------------------------------------------------------------------
// stripe_void_invoice
// ---------------------------------------------------------------------------
describe('stripe_void_invoice handler', () => {
  it('voids invoice', async () => {
    mockStripe = {
      invoices: {
        voidInvoice: async () => ({ id: 'in_1', status: 'void' })
      }
    };
    const result = await getTool('stripe_void_invoice').handler({ invoiceId: 'in_1' });
    assert.equal(result.status, 'void');
  });
});

// ---------------------------------------------------------------------------
// stripe_list_subscriptions
// ---------------------------------------------------------------------------
describe('stripe_list_subscriptions handler', () => {
  it('returns subscriptions', async () => {
    mockStripe = {
      subscriptions: {
        list: async () => ({ data: [
          {
            id: 'sub_1', status: 'active', customer: 'cus_1',
            current_period_end: 1700000000,
            items: { data: [{ price: { id: 'price_1', product: 'prod_1' }, quantity: 1 }] }
          }
        ] })
      }
    };
    const result = await getTool('stripe_list_subscriptions').handler({});
    assert.equal(result[0].id, 'sub_1');
    assert.equal(result[0].items[0].priceId, 'price_1');
  });
});

// ---------------------------------------------------------------------------
// stripe_cancel_subscription
// ---------------------------------------------------------------------------
describe('stripe_cancel_subscription handler', () => {
  it('cancels at period end by default', async () => {
    let capturedId, capturedParams;
    mockStripe = {
      subscriptions: {
        update: async (id, params) => { capturedId = id; capturedParams = params; return { id, status: 'active', cancel_at_period_end: true }; },
        cancel: async () => ({ id: 'sub_1', status: 'canceled', cancel_at_period_end: false })
      }
    };
    const result = await getTool('stripe_cancel_subscription').handler({ subscriptionId: 'sub_1' });
    assert.equal(capturedId, 'sub_1');
    assert.equal(capturedParams.cancel_at_period_end, true);
    assert.equal(result.cancelAtPeriodEnd, true);
  });

  it('cancels immediately when atPeriodEnd=false', async () => {
    let cancelledId;
    mockStripe = {
      subscriptions: {
        update: async () => ({}),
        cancel: async (id) => { cancelledId = id; return { id, status: 'canceled', cancel_at_period_end: false }; }
      }
    };
    const result = await getTool('stripe_cancel_subscription').handler({ subscriptionId: 'sub_1', atPeriodEnd: false });
    assert.equal(cancelledId, 'sub_1');
    assert.equal(result.status, 'canceled');
  });
});

// ---------------------------------------------------------------------------
// stripe_get_balance
// ---------------------------------------------------------------------------
describe('stripe_get_balance handler', () => {
  it('returns balance', async () => {
    mockStripe = {
      balance: {
        retrieve: async () => ({
          available: [{ amount: 10000, currency: 'usd' }],
          pending: [{ amount: 5000, currency: 'usd' }]
        })
      }
    };
    const result = await getTool('stripe_get_balance').handler({});
    assert.equal(result.available[0].amount, 10000);
    assert.equal(result.pending[0].amount, 5000);
  });
});

// ---------------------------------------------------------------------------
// stripe_list_charges
// ---------------------------------------------------------------------------
describe('stripe_list_charges handler', () => {
  it('returns charges', async () => {
    mockStripe = {
      charges: {
        list: async () => ({ data: [
          { id: 'ch_1', amount: 2000, currency: 'usd', status: 'succeeded', customer: 'cus_1', description: 'Payment', created: 1700000000 }
        ] })
      }
    };
    const result = await getTool('stripe_list_charges').handler({});
    assert.equal(result[0].id, 'ch_1');
    assert.equal(result[0].amount, 2000);
  });

  it('passes customerId filter', async () => {
    let captured;
    mockStripe = {
      charges: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_charges').handler({ customerId: 'cus_1' });
    assert.equal(captured.customer, 'cus_1');
  });
});

// ---------------------------------------------------------------------------
// stripe_create_payment_link
// ---------------------------------------------------------------------------
describe('stripe_create_payment_link handler', () => {
  it('creates payment link', async () => {
    let captured;
    mockStripe = {
      paymentLinks: {
        create: async (params) => { captured = params; return { id: 'plink_1', url: 'https://pay.stripe.com/test', active: true }; }
      }
    };
    const result = await getTool('stripe_create_payment_link').handler({ priceId: 'price_1', quantity: 3 });
    assert.equal(result.url, 'https://pay.stripe.com/test');
    assert.deepEqual(captured.line_items, [{ price: 'price_1', quantity: 3 }]);
  });

  it('defaults quantity to 1', async () => {
    let captured;
    mockStripe = {
      paymentLinks: {
        create: async (params) => { captured = params; return { id: 'plink_2', url: 'https://x', active: true }; }
      }
    };
    await getTool('stripe_create_payment_link').handler({ priceId: 'price_1' });
    assert.deepEqual(captured.line_items, [{ price: 'price_1', quantity: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('stripe error handling', () => {
  it('propagates API errors', async () => {
    mockStripe = {
      customers: { list: async () => { throw new Error('Stripe API 401'); } }
    };
    await assert.rejects(() => getTool('stripe_list_customers').handler({}));
  });

  it('propagates 404 errors', async () => {
    mockStripe = {
      customers: { retrieve: async () => { throw new Error('No such customer'); } }
    };
    await assert.rejects(() => getTool('stripe_get_customer').handler({ customerId: 'bad' }));
  });
});
