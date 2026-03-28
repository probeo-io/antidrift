import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let tools;

before(async () => {
  const mod = await import('../connectors/stripe.mjs');
  tools = mod.tools;
});

const EXPECTED_TOOLS = [
  'stripe_list_customers', 'stripe_get_customer', 'stripe_create_customer', 'stripe_update_customer',
  'stripe_list_products', 'stripe_list_prices',
  'stripe_create_invoice', 'stripe_add_invoice_line', 'stripe_finalize_invoice',
  'stripe_list_invoices', 'stripe_send_invoice', 'stripe_void_invoice',
  'stripe_list_subscriptions', 'stripe_cancel_subscription',
  'stripe_get_balance', 'stripe_list_charges', 'stripe_create_payment_link',
];

describe('stripe tool definitions', () => {
  it('exports a non-empty tools array', () => {
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
  });

  it('has expected tool count', () => {
    assert.equal(tools.length, EXPECTED_TOOLS.length);
  });

  it('has all expected tools', () => {
    const names = tools.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`);
    }
  });

  it('has no duplicate tool names', () => {
    const names = tools.map(t => t.name);
    assert.equal(names.length, new Set(names).size);
  });

  it('all tool names start with stripe_ prefix', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('stripe_'), `Tool ${tool.name} missing stripe_ prefix`);
    }
  });

  it('every tool has name, description, inputSchema, handler', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.name, 'string');
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.inputSchema);
      assert.equal(tool.inputSchema.type, 'object');
      assert.ok(typeof tool.inputSchema.properties === 'object');
      assert.equal(typeof tool.handler, 'function');
    }
  });

  it('required fields exist in properties', () => {
    for (const tool of tools) {
      if (tool.inputSchema.required) {
        for (const field of tool.inputSchema.required) {
          assert.ok(tool.inputSchema.properties[field], `Tool ${tool.name} requires '${field}' not in properties`);
        }
      }
    }
  });

  it('all property types are valid JSON Schema types', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const tool of tools) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        if (prop.type) {
          assert.ok(validTypes.includes(prop.type), `Tool ${tool.name}.${key} has invalid type: ${prop.type}`);
        }
      }
    }
  });
});
