/**
 * Comprehensive unit tests for mcp-stripe tools/*.mjs (zeromcp format).
 *
 * Each tool exports { description, input, execute } where
 * execute(args, ctx) receives ctx.credentials and ctx.fetch.
 *
 * Strategy: mock the Stripe constructor via mock.module so that
 * createClient(credentials) returns a stripe object we control.
 */
import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Stripe mock setup — must happen before any tool imports
// ---------------------------------------------------------------------------
let mockStripeInstance;

await mock.module('stripe', {
  defaultExport: class FakeStripe {
    constructor(_key) { return mockStripeInstance; }
  }
});

// Base fake ctx — real tools call createClient(ctx.credentials) which calls new Stripe(key)
function ctx(extra = {}) {
  return { credentials: { apiKey: 'sk_test_fake' }, fetch: globalThis.fetch, ...extra };
}

// ---------------------------------------------------------------------------
// Import all tools after mock is installed
// ---------------------------------------------------------------------------
let toolModules;

before(async () => {
  toolModules = {
    get_balance:          (await import('../tools/get_balance.mjs')).default,
    list_customers:       (await import('../tools/list_customers.mjs')).default,
    create_customer:      (await import('../tools/create_customer.mjs')).default,
    get_customer:         (await import('../tools/get_customer.mjs')).default,
    update_customer:      (await import('../tools/update_customer.mjs')).default,
    list_charges:         (await import('../tools/list_charges.mjs')).default,
    list_invoices:        (await import('../tools/list_invoices.mjs')).default,
    create_invoice:       (await import('../tools/create_invoice.mjs')).default,
    add_invoice_line:     (await import('../tools/add_invoice_line.mjs')).default,
    finalize_invoice:     (await import('../tools/finalize_invoice.mjs')).default,
    send_invoice:         (await import('../tools/send_invoice.mjs')).default,
    void_invoice:         (await import('../tools/void_invoice.mjs')).default,
    list_subscriptions:   (await import('../tools/list_subscriptions.mjs')).default,
    cancel_subscription:  (await import('../tools/cancel_subscription.mjs')).default,
    list_products:        (await import('../tools/list_products.mjs')).default,
    list_prices:          (await import('../tools/list_prices.mjs')).default,
    create_payment_link:  (await import('../tools/create_payment_link.mjs')).default,
  };
  // reset mock instance after each test
  mockStripeInstance = {};
});

afterEach(() => {
  mockStripeInstance = {};
});

// ---------------------------------------------------------------------------
// Tool structure validation
// ---------------------------------------------------------------------------
describe('tool structure', () => {
  it('every tool exports description, input, execute', () => {
    for (const [name, tool] of Object.entries(toolModules)) {
      assert.equal(typeof tool.description, 'string', `${name}: description must be string`);
      assert.ok(tool.description.length > 0, `${name}: description must be non-empty`);
      assert.ok(tool.input !== null && typeof tool.input === 'object', `${name}: input must be object`);
      assert.equal(typeof tool.execute, 'function', `${name}: execute must be function`);
    }
  });

  it('every tool input property has type and description', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const [name, tool] of Object.entries(toolModules)) {
      for (const [key, prop] of Object.entries(tool.input)) {
        assert.ok(typeof prop.type === 'string', `${name}.input.${key}: must have type`);
        assert.ok(validTypes.includes(prop.type), `${name}.input.${key}: invalid type '${prop.type}'`);
        assert.ok(typeof prop.description === 'string', `${name}.input.${key}: must have description`);
        assert.ok(prop.description.length > 0, `${name}.input.${key}: description must be non-empty`);
      }
    }
  });

  it('has all 17 expected tool files', () => {
    assert.equal(Object.keys(toolModules).length, 17);
  });
});

// ---------------------------------------------------------------------------
// get_balance
// ---------------------------------------------------------------------------
describe('get_balance', () => {
  it('returns available and pending arrays', async () => {
    mockStripeInstance = {
      balance: {
        retrieve: async () => ({
          available: [{ amount: 5000, currency: 'usd' }],
          pending: [{ amount: 1200, currency: 'usd' }],
        })
      }
    };
    const result = await toolModules.get_balance.execute({}, ctx());
    assert.deepEqual(result.available, [{ amount: 5000, currency: 'usd' }]);
    assert.deepEqual(result.pending, [{ amount: 1200, currency: 'usd' }]);
  });

  it('maps only amount and currency from each entry', async () => {
    mockStripeInstance = {
      balance: {
        retrieve: async () => ({
          available: [{ amount: 100, currency: 'eur', extra_field: 'ignored' }],
          pending: [],
        })
      }
    };
    const result = await toolModules.get_balance.execute({}, ctx());
    assert.deepEqual(result.available[0], { amount: 100, currency: 'eur' });
  });

  it('handles multiple currencies', async () => {
    mockStripeInstance = {
      balance: {
        retrieve: async () => ({
          available: [
            { amount: 1000, currency: 'usd' },
            { amount: 2000, currency: 'eur' }
          ],
          pending: [],
        })
      }
    };
    const result = await toolModules.get_balance.execute({}, ctx());
    assert.equal(result.available.length, 2);
  });

  it('propagates errors from stripe SDK', async () => {
    mockStripeInstance = {
      balance: { retrieve: async () => { throw new Error('Auth failed'); } }
    };
    await assert.rejects(
      () => toolModules.get_balance.execute({}, ctx()),
      /Auth failed/
    );
  });
});

// ---------------------------------------------------------------------------
// list_customers
// ---------------------------------------------------------------------------
describe('list_customers', () => {
  it('returns mapped customer array', async () => {
    mockStripeInstance = {
      customers: {
        list: async () => ({
          data: [{ id: 'cus_1', name: 'Alice', email: 'alice@example.com' }]
        })
      }
    };
    const result = await toolModules.list_customers.execute({}, ctx());
    assert.deepEqual(result, [{ id: 'cus_1', name: 'Alice', email: 'alice@example.com' }]);
  });

  it('passes limit=10 by default', async () => {
    let captured;
    mockStripeInstance = {
      customers: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_customers.execute({}, ctx());
    assert.equal(captured.limit, 10);
    assert.equal(captured.email, undefined);
  });

  it('passes custom limit and email filter', async () => {
    let captured;
    mockStripeInstance = {
      customers: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_customers.execute({ limit: 25, email: 'test@test.com' }, ctx());
    assert.equal(captured.limit, 25);
    assert.equal(captured.email, 'test@test.com');
  });

  it('returns empty array when no customers', async () => {
    mockStripeInstance = { customers: { list: async () => ({ data: [] }) } };
    const result = await toolModules.list_customers.execute({}, ctx());
    assert.deepEqual(result, []);
  });

  it('propagates SDK error', async () => {
    mockStripeInstance = {
      customers: { list: async () => { throw new Error('Rate limit exceeded'); } }
    };
    await assert.rejects(() => toolModules.list_customers.execute({}, ctx()), /Rate limit exceeded/);
  });
});

// ---------------------------------------------------------------------------
// create_customer
// ---------------------------------------------------------------------------
describe('create_customer', () => {
  it('creates customer with name, email, description', async () => {
    let captured;
    mockStripeInstance = {
      customers: {
        create: async (p) => {
          captured = p;
          return { id: 'cus_new', name: p.name, email: p.email };
        }
      }
    };
    const result = await toolModules.create_customer.execute(
      { name: 'Bob', email: 'bob@example.com', description: 'VIP' },
      ctx()
    );
    assert.equal(captured.name, 'Bob');
    assert.equal(captured.email, 'bob@example.com');
    assert.equal(captured.description, 'VIP');
    assert.equal(result.id, 'cus_new');
  });

  it('omits undefined optional fields', async () => {
    let captured;
    mockStripeInstance = {
      customers: {
        create: async (p) => { captured = p; return { id: 'cus_x', name: undefined, email: undefined }; }
      }
    };
    await toolModules.create_customer.execute({}, ctx());
    assert.equal(Object.keys(captured).length, 0);
  });

  it('returns id, name, email', async () => {
    mockStripeInstance = {
      customers: {
        create: async () => ({ id: 'cus_1', name: 'Test', email: 't@e.com' })
      }
    };
    const result = await toolModules.create_customer.execute({ name: 'Test', email: 't@e.com' }, ctx());
    assert.ok('id' in result);
    assert.ok('name' in result);
    assert.ok('email' in result);
    assert.equal(Object.keys(result).length, 3);
  });
});

// ---------------------------------------------------------------------------
// get_customer
// ---------------------------------------------------------------------------
describe('get_customer', () => {
  it('returns full customer details', async () => {
    const raw = {
      id: 'cus_abc', name: 'Carol', email: 'carol@x.com', phone: '555-1234',
      description: 'Test', created: 1700000000, metadata: { tier: 'gold' },
      balance: -500, currency: 'usd'
    };
    mockStripeInstance = { customers: { retrieve: async () => raw } };
    const result = await toolModules.get_customer.execute({ customerId: 'cus_abc' }, ctx());
    assert.equal(result.id, 'cus_abc');
    assert.equal(result.name, 'Carol');
    assert.equal(result.phone, '555-1234');
    assert.equal(result.balance, -500);
    assert.equal(result.metadata.tier, 'gold');
    assert.ok(result.created.startsWith('2023'));
  });

  it('converts created timestamp to ISO string', async () => {
    mockStripeInstance = {
      customers: {
        retrieve: async () => ({
          id: 'cus_1', name: '', email: '', phone: '', description: '',
          created: 0, metadata: {}, balance: 0, currency: 'usd'
        })
      }
    };
    const result = await toolModules.get_customer.execute({ customerId: 'cus_1' }, ctx());
    assert.ok(typeof result.created === 'string');
    assert.ok(result.created.includes('T'));
  });

  it('propagates not-found error', async () => {
    mockStripeInstance = {
      customers: { retrieve: async () => { throw new Error('No such customer: cus_bad'); } }
    };
    await assert.rejects(() => toolModules.get_customer.execute({ customerId: 'cus_bad' }, ctx()), /No such customer/);
  });
});

// ---------------------------------------------------------------------------
// update_customer
// ---------------------------------------------------------------------------
describe('update_customer', () => {
  it('calls update with correct params', async () => {
    let capturedId, capturedParams;
    mockStripeInstance = {
      customers: {
        update: async (id, p) => {
          capturedId = id;
          capturedParams = p;
          return { id, name: p.name, email: p.email, description: p.description };
        }
      }
    };
    await toolModules.update_customer.execute(
      { customerId: 'cus_1', name: 'Updated', email: 'new@x.com', description: 'Changed' },
      ctx()
    );
    assert.equal(capturedId, 'cus_1');
    assert.equal(capturedParams.name, 'Updated');
  });

  it('omits undefined fields from params (undefined is treated as absent)', async () => {
    let capturedParams;
    mockStripeInstance = {
      customers: {
        update: async (_id, p) => {
          capturedParams = p;
          return { id: 'cus_1', name: p.name, email: p.email, description: p.description };
        }
      }
    };
    // name=undefined: the tool checks `if (name !== undefined)` so it is excluded
    await toolModules.update_customer.execute(
      { customerId: 'cus_1', name: undefined, email: 'e@e.com' },
      ctx()
    );
    // name is undefined so it is NOT included in params
    assert.ok(!('name' in capturedParams));
    assert.equal(capturedParams.email, 'e@e.com');
  });

  it('returns id, name, email, description', async () => {
    mockStripeInstance = {
      customers: {
        update: async (id, p) => ({ id, name: 'N', email: 'e@x', description: 'D' })
      }
    };
    const result = await toolModules.update_customer.execute({ customerId: 'cus_1' }, ctx());
    assert.ok('id' in result && 'name' in result && 'email' in result && 'description' in result);
  });
});

// ---------------------------------------------------------------------------
// list_charges
// ---------------------------------------------------------------------------
describe('list_charges', () => {
  it('returns mapped charge array', async () => {
    mockStripeInstance = {
      charges: {
        list: async () => ({
          data: [{
            id: 'ch_1', amount: 2000, currency: 'usd', status: 'succeeded',
            customer: 'cus_1', description: 'Test charge', created: 1700000000
          }]
        })
      }
    };
    const result = await toolModules.list_charges.execute({}, ctx());
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'ch_1');
    assert.equal(result[0].amount, 2000);
    assert.ok(typeof result[0].created === 'string');
  });

  it('passes limit and customer filter', async () => {
    let captured;
    mockStripeInstance = {
      charges: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_charges.execute({ customerId: 'cus_1', limit: 5 }, ctx());
    assert.equal(captured.customer, 'cus_1');
    assert.equal(captured.limit, 5);
  });

  it('omits customer filter when not provided', async () => {
    let captured;
    mockStripeInstance = {
      charges: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_charges.execute({}, ctx());
    assert.equal(captured.customer, undefined);
    assert.equal(captured.limit, 10);
  });

  it('converts created timestamp', async () => {
    mockStripeInstance = {
      charges: {
        list: async () => ({
          data: [{
            id: 'ch_x', amount: 0, currency: 'usd', status: 'succeeded',
            customer: null, description: null, created: 1700000000
          }]
        })
      }
    };
    const result = await toolModules.list_charges.execute({}, ctx());
    assert.ok(result[0].created.includes('T'));
  });
});

// ---------------------------------------------------------------------------
// list_invoices
// ---------------------------------------------------------------------------
describe('list_invoices', () => {
  it('returns mapped invoice array', async () => {
    mockStripeInstance = {
      invoices: {
        list: async () => ({
          data: [{
            id: 'in_1', status: 'open', total: 5000,
            customer: 'cus_1', created: 1700000000, invoice_pdf: 'https://pdf.url'
          }]
        })
      }
    };
    const result = await toolModules.list_invoices.execute({}, ctx());
    assert.equal(result[0].id, 'in_1');
    assert.equal(result[0].pdfUrl, 'https://pdf.url');
    assert.ok(typeof result[0].created === 'string');
  });

  it('passes customer and status filters', async () => {
    let captured;
    mockStripeInstance = {
      invoices: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_invoices.execute({ customerId: 'cus_1', status: 'paid', limit: 3 }, ctx());
    assert.equal(captured.customer, 'cus_1');
    assert.equal(captured.status, 'paid');
    assert.equal(captured.limit, 3);
  });

  it('omits filters when not provided', async () => {
    let captured;
    mockStripeInstance = {
      invoices: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_invoices.execute({}, ctx());
    assert.equal(captured.customer, undefined);
    assert.equal(captured.status, undefined);
    assert.equal(captured.limit, 10);
  });
});

// ---------------------------------------------------------------------------
// create_invoice
// ---------------------------------------------------------------------------
describe('create_invoice', () => {
  it('creates invoice with customer and description', async () => {
    let captured;
    mockStripeInstance = {
      invoices: {
        create: async (p) => {
          captured = p;
          return { id: 'in_new', status: 'draft', hosted_invoice_url: 'https://hosted' };
        }
      }
    };
    const result = await toolModules.create_invoice.execute(
      { customerId: 'cus_1', description: 'Consulting' },
      ctx()
    );
    assert.equal(captured.customer, 'cus_1');
    assert.equal(captured.description, 'Consulting');
    assert.equal(captured.auto_advance, false);
    assert.equal(result.id, 'in_new');
    assert.equal(result.url, 'https://hosted');
  });

  it('sets auto_advance to false always', async () => {
    let captured;
    mockStripeInstance = {
      invoices: {
        create: async (p) => { captured = p; return { id: 'in_1', status: 'draft', hosted_invoice_url: null }; }
      }
    };
    await toolModules.create_invoice.execute({ customerId: 'cus_1' }, ctx());
    assert.equal(captured.auto_advance, false);
  });
});

// ---------------------------------------------------------------------------
// add_invoice_line
// ---------------------------------------------------------------------------
describe('add_invoice_line', () => {
  it('adds line with priceId', async () => {
    let capturedItem;
    mockStripeInstance = {
      invoices: { retrieve: async () => ({ customer: 'cus_1' }) },
      invoiceItems: {
        create: async (p) => { capturedItem = p; return { id: 'ii_1', amount: 0, description: null }; }
      }
    };
    await toolModules.add_invoice_line.execute(
      { invoiceId: 'in_1', priceId: 'price_abc', quantity: 2 },
      ctx()
    );
    assert.equal(capturedItem.price, 'price_abc');
    assert.equal(capturedItem.quantity, 2);
    assert.equal(capturedItem.invoice, 'in_1');
    assert.equal(capturedItem.customer, 'cus_1');
  });

  it('adds custom line item without priceId', async () => {
    let capturedItem;
    mockStripeInstance = {
      invoices: { retrieve: async () => ({ customer: 'cus_2' }) },
      invoiceItems: {
        create: async (p) => { capturedItem = p; return { id: 'ii_2', amount: 5000, description: 'Custom' }; }
      }
    };
    const result = await toolModules.add_invoice_line.execute(
      { invoiceId: 'in_2', description: 'Custom', amount: 5000 },
      ctx()
    );
    assert.equal(capturedItem.description, 'Custom');
    assert.equal(capturedItem.amount, 5000);
    assert.equal(capturedItem.currency, 'usd');
    assert.equal(result.amount, 5000);
  });

  it('retrieves invoice to get customer id', async () => {
    let retrievedId;
    mockStripeInstance = {
      invoices: { retrieve: async (id) => { retrievedId = id; return { customer: 'cus_x' }; } },
      invoiceItems: { create: async () => ({ id: 'ii_3', amount: 0, description: null }) }
    };
    await toolModules.add_invoice_line.execute({ invoiceId: 'in_999', priceId: 'p_1' }, ctx());
    assert.equal(retrievedId, 'in_999');
  });
});

// ---------------------------------------------------------------------------
// finalize_invoice
// ---------------------------------------------------------------------------
describe('finalize_invoice', () => {
  it('finalizes invoice and returns full response', async () => {
    mockStripeInstance = {
      invoices: {
        finalizeInvoice: async (id) => ({
          id, status: 'open', invoice_pdf: 'https://pdf', hosted_invoice_url: 'https://hosted', total: 9900
        })
      }
    };
    const result = await toolModules.finalize_invoice.execute({ invoiceId: 'in_draft' }, ctx());
    assert.equal(result.id, 'in_draft');
    assert.equal(result.status, 'open');
    assert.equal(result.pdfUrl, 'https://pdf');
    assert.equal(result.hostedUrl, 'https://hosted');
    assert.equal(result.total, 9900);
  });

  it('propagates error if invoice cannot be finalized', async () => {
    mockStripeInstance = {
      invoices: {
        finalizeInvoice: async () => { throw new Error('Invoice already finalized'); }
      }
    };
    await assert.rejects(
      () => toolModules.finalize_invoice.execute({ invoiceId: 'in_open' }, ctx()),
      /already finalized/
    );
  });
});

// ---------------------------------------------------------------------------
// send_invoice
// ---------------------------------------------------------------------------
describe('send_invoice', () => {
  it('sends invoice and returns status', async () => {
    mockStripeInstance = {
      invoices: {
        sendInvoice: async (id) => ({ id, status: 'open', hosted_invoice_url: 'https://hosted' })
      }
    };
    const result = await toolModules.send_invoice.execute({ invoiceId: 'in_open' }, ctx());
    assert.equal(result.id, 'in_open');
    assert.equal(result.status, 'open');
    assert.equal(result.hostedUrl, 'https://hosted');
  });
});

// ---------------------------------------------------------------------------
// void_invoice
// ---------------------------------------------------------------------------
describe('void_invoice', () => {
  it('voids invoice and returns id and status', async () => {
    mockStripeInstance = {
      invoices: {
        voidInvoice: async (id) => ({ id, status: 'void' })
      }
    };
    const result = await toolModules.void_invoice.execute({ invoiceId: 'in_1' }, ctx());
    assert.equal(result.id, 'in_1');
    assert.equal(result.status, 'void');
  });
});

// ---------------------------------------------------------------------------
// list_subscriptions
// ---------------------------------------------------------------------------
describe('list_subscriptions', () => {
  it('returns mapped subscription array', async () => {
    const ts = 1800000000;
    mockStripeInstance = {
      subscriptions: {
        list: async () => ({
          data: [{
            id: 'sub_1', status: 'active', customer: 'cus_1',
            current_period_end: ts,
            items: {
              data: [{
                price: { id: 'price_1', product: 'prod_1' },
                quantity: 2
              }]
            }
          }]
        })
      }
    };
    const result = await toolModules.list_subscriptions.execute({}, ctx());
    assert.equal(result[0].id, 'sub_1');
    assert.ok(typeof result[0].currentPeriodEnd === 'string');
    assert.equal(result[0].items[0].priceId, 'price_1');
    assert.equal(result[0].items[0].quantity, 2);
  });

  it('passes customer and status filters', async () => {
    let captured;
    mockStripeInstance = {
      subscriptions: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_subscriptions.execute({ customerId: 'cus_x', status: 'active', limit: 5 }, ctx());
    assert.equal(captured.customer, 'cus_x');
    assert.equal(captured.status, 'active');
    assert.equal(captured.limit, 5);
  });
});

// ---------------------------------------------------------------------------
// cancel_subscription
// ---------------------------------------------------------------------------
describe('cancel_subscription', () => {
  it('cancels at period end by default (update)', async () => {
    let updateCalled = false;
    let cancelCalled = false;
    mockStripeInstance = {
      subscriptions: {
        update: async (id, p) => {
          updateCalled = true;
          return { id, status: 'active', cancel_at_period_end: true };
        },
        cancel: async () => { cancelCalled = true; return {}; }
      }
    };
    const result = await toolModules.cancel_subscription.execute({ subscriptionId: 'sub_1' }, ctx());
    assert.ok(updateCalled);
    assert.ok(!cancelCalled);
    assert.equal(result.cancelAtPeriodEnd, true);
  });

  it('cancels immediately when atPeriodEnd=false', async () => {
    let cancelCalled = false;
    mockStripeInstance = {
      subscriptions: {
        update: async () => ({}),
        cancel: async (id) => { cancelCalled = true; return { id, status: 'canceled', cancel_at_period_end: false }; }
      }
    };
    const result = await toolModules.cancel_subscription.execute(
      { subscriptionId: 'sub_1', atPeriodEnd: false },
      ctx()
    );
    assert.ok(cancelCalled);
    assert.equal(result.status, 'canceled');
  });

  it('returns id, status, cancelAtPeriodEnd', async () => {
    mockStripeInstance = {
      subscriptions: {
        update: async (id) => ({ id, status: 'active', cancel_at_period_end: true })
      }
    };
    const result = await toolModules.cancel_subscription.execute({ subscriptionId: 'sub_99' }, ctx());
    assert.ok('id' in result);
    assert.ok('status' in result);
    assert.ok('cancelAtPeriodEnd' in result);
  });
});

// ---------------------------------------------------------------------------
// list_products
// ---------------------------------------------------------------------------
describe('list_products', () => {
  it('returns mapped products', async () => {
    mockStripeInstance = {
      products: {
        list: async () => ({
          data: [{ id: 'prod_1', name: 'Widget', description: 'A widget' }]
        })
      }
    };
    const result = await toolModules.list_products.execute({}, ctx());
    assert.deepEqual(result, [{ id: 'prod_1', name: 'Widget', description: 'A widget' }]);
  });

  it('passes active:true and limit', async () => {
    let captured;
    mockStripeInstance = {
      products: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_products.execute({ limit: 20 }, ctx());
    assert.equal(captured.active, true);
    assert.equal(captured.limit, 20);
  });

  it('uses default limit 10', async () => {
    let captured;
    mockStripeInstance = {
      products: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_products.execute({}, ctx());
    assert.equal(captured.limit, 10);
  });
});

// ---------------------------------------------------------------------------
// list_prices
// ---------------------------------------------------------------------------
describe('list_prices', () => {
  it('returns mapped prices with recurring info', async () => {
    mockStripeInstance = {
      prices: {
        list: async () => ({
          data: [{
            id: 'price_1', unit_amount: 2999, currency: 'usd',
            recurring: { interval: 'month' }, nickname: 'Monthly'
          }]
        })
      }
    };
    const result = await toolModules.list_prices.execute({ productId: 'prod_1' }, ctx());
    assert.equal(result[0].id, 'price_1');
    assert.equal(result[0].unitAmount, 2999);
    assert.deepEqual(result[0].recurring, { interval: 'month' });
    assert.equal(result[0].nickname, 'Monthly');
  });

  it('passes productId and active:true', async () => {
    let captured;
    mockStripeInstance = {
      prices: { list: async (p) => { captured = p; return { data: [] }; } }
    };
    await toolModules.list_prices.execute({ productId: 'prod_x' }, ctx());
    assert.equal(captured.product, 'prod_x');
    assert.equal(captured.active, true);
  });
});

// ---------------------------------------------------------------------------
// create_payment_link
// ---------------------------------------------------------------------------
describe('create_payment_link', () => {
  it('creates link and returns id, url, active', async () => {
    let captured;
    mockStripeInstance = {
      paymentLinks: {
        create: async (p) => {
          captured = p;
          return { id: 'plink_1', url: 'https://buy.stripe.com/test', active: true };
        }
      }
    };
    const result = await toolModules.create_payment_link.execute({ priceId: 'price_1', quantity: 3 }, ctx());
    assert.deepEqual(captured.line_items, [{ price: 'price_1', quantity: 3 }]);
    assert.equal(result.id, 'plink_1');
    assert.equal(result.url, 'https://buy.stripe.com/test');
    assert.equal(result.active, true);
  });

  it('defaults quantity to 1', async () => {
    let captured;
    mockStripeInstance = {
      paymentLinks: {
        create: async (p) => { captured = p; return { id: 'pl_1', url: 'u', active: true }; }
      }
    };
    await toolModules.create_payment_link.execute({ priceId: 'price_2' }, ctx());
    assert.equal(captured.line_items[0].quantity, 1);
  });

  it('propagates error', async () => {
    mockStripeInstance = {
      paymentLinks: {
        create: async () => { throw new Error('Price not found'); }
      }
    };
    await assert.rejects(
      () => toolModules.create_payment_link.execute({ priceId: 'price_bad' }, ctx()),
      /Price not found/
    );
  });
});
