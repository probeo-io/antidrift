import { describe, it, before, afterEach, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'stripe.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

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

before(async () => {
  const mod = await import('../connectors/stripe.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
});

afterEach(() => {
  mockStripe = {};
});

after(() => {
  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  }
});

function getTool(name) { return toolMap[name]; }

// ---------------------------------------------------------------------------
// Missing required parameters
// ---------------------------------------------------------------------------
describe('missing required parameters', () => {
  it('stripe_get_customer rejects on bad customerId', async () => {
    mockStripe = {
      customers: { retrieve: async () => { throw new Error('No such customer'); } }
    };
    await assert.rejects(() => getTool('stripe_get_customer').handler({ customerId: undefined }));
  });

  it('stripe_list_prices rejects on bad productId', async () => {
    mockStripe = {
      prices: { list: async () => { throw new Error('No such product'); } }
    };
    await assert.rejects(() => getTool('stripe_list_prices').handler({ productId: undefined }));
  });

  it('stripe_finalize_invoice rejects on bad invoiceId', async () => {
    mockStripe = {
      invoices: { finalizeInvoice: async () => { throw new Error('No such invoice'); } }
    };
    await assert.rejects(() => getTool('stripe_finalize_invoice').handler({ invoiceId: undefined }));
  });
});

// ---------------------------------------------------------------------------
// Optional parameters omitted
// ---------------------------------------------------------------------------
describe('optional parameters omitted', () => {
  it('stripe_list_customers uses default limit=10 and no email', async () => {
    let captured;
    mockStripe = {
      customers: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_customers').handler({});
    assert.equal(captured.limit, 10);
    assert.equal(captured.email, undefined);
  });

  it('stripe_create_customer omits undefined fields', async () => {
    let captured;
    mockStripe = {
      customers: {
        create: async (params) => { captured = params; return { id: 'cus_1', name: undefined, email: undefined }; }
      }
    };
    await getTool('stripe_create_customer').handler({});
    assert.equal(Object.keys(captured).length, 0);
  });

  it('stripe_list_invoices uses default limit=10 with no filters', async () => {
    let captured;
    mockStripe = {
      invoices: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_invoices').handler({});
    assert.equal(captured.limit, 10);
    assert.equal(captured.customer, undefined);
    assert.equal(captured.status, undefined);
  });

  it('stripe_list_subscriptions uses default limit=10', async () => {
    let captured;
    mockStripe = {
      subscriptions: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_subscriptions').handler({});
    assert.equal(captured.limit, 10);
  });

  it('stripe_cancel_subscription defaults atPeriodEnd to true', async () => {
    let updateCalled = false;
    let cancelCalled = false;
    mockStripe = {
      subscriptions: {
        update: async () => { updateCalled = true; return { id: 'sub_1', status: 'active', cancel_at_period_end: true }; },
        cancel: async () => { cancelCalled = true; return {}; }
      }
    };
    await getTool('stripe_cancel_subscription').handler({ subscriptionId: 'sub_1' });
    assert.ok(updateCalled);
    assert.ok(!cancelCalled);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------
describe('error responses', () => {
  it('handles 401 authentication error', async () => {
    mockStripe = {
      customers: { list: async () => { throw new Error('Invalid API Key'); } }
    };
    await assert.rejects(
      () => getTool('stripe_list_customers').handler({}),
      (err) => { assert.ok(err.message.includes('Invalid API Key')); return true; }
    );
  });

  it('handles 404 not found', async () => {
    mockStripe = {
      customers: { retrieve: async () => { throw new Error('No such customer: cus_bad'); } }
    };
    await assert.rejects(
      () => getTool('stripe_get_customer').handler({ customerId: 'cus_bad' }),
      (err) => { assert.ok(err.message.includes('cus_bad')); return true; }
    );
  });

  it('handles 429 rate limit', async () => {
    mockStripe = {
      products: { list: async () => { throw new Error('Rate limit exceeded'); } }
    };
    await assert.rejects(() => getTool('stripe_list_products').handler({}));
  });

  it('handles 500 server error', async () => {
    mockStripe = {
      balance: { retrieve: async () => { throw new Error('Internal server error'); } }
    };
    await assert.rejects(() => getTool('stripe_get_balance').handler({}));
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------
describe('empty results', () => {
  it('stripe_list_customers returns empty array', async () => {
    mockStripe = { customers: { list: async () => ({ data: [] }) } };
    const result = await getTool('stripe_list_customers').handler({});
    assert.deepEqual(result, []);
  });

  it('stripe_list_products returns empty array', async () => {
    mockStripe = { products: { list: async () => ({ data: [] }) } };
    const result = await getTool('stripe_list_products').handler({});
    assert.deepEqual(result, []);
  });

  it('stripe_list_prices returns empty array', async () => {
    mockStripe = { prices: { list: async () => ({ data: [] }) } };
    const result = await getTool('stripe_list_prices').handler({ productId: 'prod_1' });
    assert.deepEqual(result, []);
  });

  it('stripe_list_invoices returns empty array', async () => {
    mockStripe = { invoices: { list: async () => ({ data: [] }) } };
    const result = await getTool('stripe_list_invoices').handler({});
    assert.deepEqual(result, []);
  });

  it('stripe_list_subscriptions returns empty array', async () => {
    mockStripe = { subscriptions: { list: async () => ({ data: [] }) } };
    const result = await getTool('stripe_list_subscriptions').handler({});
    assert.deepEqual(result, []);
  });

  it('stripe_list_charges returns empty array', async () => {
    mockStripe = { charges: { list: async () => ({ data: [] }) } };
    const result = await getTool('stripe_list_charges').handler({});
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// Special characters in inputs
// ---------------------------------------------------------------------------
describe('special characters in inputs', () => {
  it('stripe_create_customer handles unicode in name', async () => {
    let captured;
    mockStripe = {
      customers: {
        create: async (params) => { captured = params; return { id: 'cus_1', name: params.name, email: params.email }; }
      }
    };
    await getTool('stripe_create_customer').handler({ name: 'Rene\u0301 M\u00fcller', email: 'rene@cafe\u0301.com' });
    assert.equal(captured.name, 'Rene\u0301 M\u00fcller');
  });

  it('stripe_update_customer handles special chars in description', async () => {
    let captured;
    mockStripe = {
      customers: {
        update: async (id, params) => { captured = params; return { id, name: 'X', email: 'x@y.com', description: params.description }; }
      }
    };
    await getTool('stripe_update_customer').handler({ customerId: 'cus_1', description: 'VIP & "Premium" <tier>' });
    assert.equal(captured.description, 'VIP & "Premium" <tier>');
  });

  it('stripe_list_customers handles email with special chars', async () => {
    let captured;
    mockStripe = {
      customers: {
        list: async (params) => { captured = params; return { data: [] }; }
      }
    };
    await getTool('stripe_list_customers').handler({ email: "user+tag@test.com" });
    assert.equal(captured.email, "user+tag@test.com");
  });
});
