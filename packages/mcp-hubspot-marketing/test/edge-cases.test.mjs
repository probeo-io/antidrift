import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'hubspot.json');
const BACKUP_PATH = CONFIG_PATH + '.marketing-edge-test-backup';

let tools;
let toolMap;

function handler(name) {
  return toolMap[name].handler;
}

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ accessToken: 'test-token' }));

  const mod = await import('../connectors/hubspot-marketing.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

afterEach(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
describe('pagination handling', () => {
  it('list_marketing_emails defaults to limit=20', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_marketing_emails')({});
    assert.ok(capturedUrl.includes('limit=20'));
  });

  it('list_campaigns passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_campaigns')({ limit: 50 });
    assert.ok(capturedUrl.includes('limit=50'));
  });

  it('list_forms passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_forms')({ limit: 3 });
    assert.ok(capturedUrl.includes('limit=3'));
  });

  it('list_landing_pages passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_landing_pages')({ limit: 7 });
    assert.ok(capturedUrl.includes('limit=7'));
  });

  it('list_blog_posts passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_blog_posts')({ limit: 100 });
    assert.ok(capturedUrl.includes('limit=100'));
  });

  it('get_form_submissions passes custom limit', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_get_form_submissions')({ formId: 'f1', limit: 5 });
    assert.ok(capturedUrl.includes('limit=5'));
  });
});

// ---------------------------------------------------------------------------
// Form submissions edge cases
// ---------------------------------------------------------------------------
describe('form submissions edge cases', () => {
  it('handles multiple submissions', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        results: [
          { submittedAt: 1711800000000, values: [{ name: 'email', value: 'a@b.com' }] },
          { submittedAt: 1711900000000, values: [{ name: 'email', value: 'c@d.com' }] },
          { submittedAt: 1712000000000, values: [{ name: 'email', value: 'e@f.com' }] }
        ]
      }),
      json: async () => ({
        results: [
          { submittedAt: 1711800000000, values: [{ name: 'email', value: 'a@b.com' }] },
          { submittedAt: 1711900000000, values: [{ name: 'email', value: 'c@d.com' }] },
          { submittedAt: 1712000000000, values: [{ name: 'email', value: 'e@f.com' }] }
        ]
      })
    }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.ok(result.includes('Submission 1'));
    assert.ok(result.includes('Submission 2'));
    assert.ok(result.includes('Submission 3'));
    assert.ok(result.includes('a@b.com'));
    assert.ok(result.includes('c@d.com'));
    assert.ok(result.includes('e@f.com'));
  });

  it('handles submission with many fields', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        results: [{
          submittedAt: 1711800000000,
          values: [
            { name: 'email', value: 'user@test.com' },
            { name: 'firstname', value: 'Jane' },
            { name: 'lastname', value: 'Doe' },
            { name: 'company', value: 'Acme' },
            { name: 'phone', value: '555-0000' }
          ]
        }]
      }),
      json: async () => ({
        results: [{
          submittedAt: 1711800000000,
          values: [
            { name: 'email', value: 'user@test.com' },
            { name: 'firstname', value: 'Jane' },
            { name: 'lastname', value: 'Doe' },
            { name: 'company', value: 'Acme' },
            { name: 'phone', value: '555-0000' }
          ]
        }]
      })
    }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.ok(result.includes('email: user@test.com'));
    assert.ok(result.includes('firstname: Jane'));
    assert.ok(result.includes('lastname: Doe'));
    assert.ok(result.includes('company: Acme'));
    assert.ok(result.includes('phone: 555-0000'));
  });

  it('handles submission without submittedAt', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        results: [{ values: [{ name: 'email', value: 'x@y.com' }] }]
      }),
      json: async () => ({
        results: [{ values: [{ name: 'email', value: 'x@y.com' }] }]
      })
    }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.ok(result.includes('Submission 1'));
    assert.ok(result.includes('email: x@y.com'));
  });
});

// ---------------------------------------------------------------------------
// Campaign stats edge cases
// ---------------------------------------------------------------------------
describe('campaign edge cases', () => {
  it('get_campaign skips id and name from properties list', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: 'c1', name: 'Test', extra: 'data' }),
      json: async () => ({ id: 'c1', name: 'Test', extra: 'data' })
    }));
    const result = await handler('hubspot_get_campaign')({ campaignId: 'c1' });
    // Should show name in header and extra, but not "id:" or "name:" in properties
    const lines = result.split('\n');
    const propLines = lines.filter(l => l.startsWith('id:') || l.startsWith('name:'));
    assert.equal(propLines.length, 0, 'Should not list id or name as properties');
    assert.ok(result.includes('extra: data'));
  });

  it('get_campaign skips null and empty properties', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: 'c1', name: 'Test', empty: '', nothing: null, valid: 'yes' }),
      json: async () => ({ id: 'c1', name: 'Test', empty: '', nothing: null, valid: 'yes' })
    }));
    const result = await handler('hubspot_get_campaign')({ campaignId: 'c1' });
    assert.ok(result.includes('valid: yes'));
    assert.ok(!result.includes('empty:'));
    assert.ok(!result.includes('nothing:'));
  });

  it('list_campaigns uses state or status field', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        results: [
          { id: 'c1', name: 'WithState', state: 'ACTIVE' },
          { id: 'c2', name: 'WithStatus', status: 'COMPLETED' },
          { id: 'c3', name: 'NoStatus' }
        ]
      }),
      json: async () => ({
        results: [
          { id: 'c1', name: 'WithState', state: 'ACTIVE' },
          { id: 'c2', name: 'WithStatus', status: 'COMPLETED' },
          { id: 'c3', name: 'NoStatus' }
        ]
      })
    }));
    const result = await handler('hubspot_list_campaigns')({});
    assert.ok(result.includes('ACTIVE'));
    assert.ok(result.includes('COMPLETED'));
    // NoStatus should not have a dash separator
    const noStatusLine = result.split('\n').find(l => l.includes('NoStatus'));
    assert.ok(!noStatusLine.includes('\u2014'));
  });
});

// ---------------------------------------------------------------------------
// Marketing email stats edge cases
// ---------------------------------------------------------------------------
describe('marketing email stats edge cases', () => {
  it('email with partial counters', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        results: [{
          id: 'e1', name: 'Partial Stats',
          statistics: { counters: { sent: 100 } }
        }]
      }),
      json: async () => ({
        results: [{
          id: 'e1', name: 'Partial Stats',
          statistics: { counters: { sent: 100 } }
        }]
      })
    }));
    const result = await handler('hubspot_list_marketing_emails')({});
    assert.ok(result.includes('sent: 100'));
    assert.ok(!result.includes('opened:'));
    assert.ok(!result.includes('clicked:'));
  });

  it('get_marketing_email with zero ratios', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        id: 'e1', name: 'Zero Ratios',
        statistics: {
          counters: { sent: 1000, open: 0 },
          ratios: { openratio: 0, clickratio: 0 }
        }
      }),
      json: async () => ({
        id: 'e1', name: 'Zero Ratios',
        statistics: {
          counters: { sent: 1000, open: 0 },
          ratios: { openratio: 0, clickratio: 0 }
        }
      })
    }));
    const result = await handler('hubspot_get_marketing_email')({ emailId: 'e1' });
    assert.ok(result.includes('0.0%'));
    assert.ok(result.includes('sent: 1000'));
  });

  it('email without name shows Untitled', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: 'e1' }] }),
      json: async () => ({ results: [{ id: 'e1' }] })
    }));
    const result = await handler('hubspot_list_marketing_emails')({});
    assert.ok(result.includes('Untitled'));
  });
});

// ---------------------------------------------------------------------------
// Landing page and blog post edge cases
// ---------------------------------------------------------------------------
describe('landing page edge cases', () => {
  it('uses title when name is missing', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: 'lp1', title: 'Title Only' }] }),
      json: async () => ({ results: [{ id: 'lp1', title: 'Title Only' }] })
    }));
    const result = await handler('hubspot_list_landing_pages')({});
    assert.ok(result.includes('Title Only'));
  });

  it('shows Untitled when no name or title', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: 'lp1' }] }),
      json: async () => ({ results: [{ id: 'lp1' }] })
    }));
    const result = await handler('hubspot_list_landing_pages')({});
    assert.ok(result.includes('Untitled'));
  });
});

describe('blog post edge cases', () => {
  it('uses title when name is missing', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [{ id: 'bp1', title: 'Blog Title' }] }),
      json: async () => ({ results: [{ id: 'bp1', title: 'Blog Title' }] })
    }));
    const result = await handler('hubspot_list_blog_posts')({});
    assert.ok(result.includes('Blog Title'));
  });

  it('get_blog_post uses title when name is missing', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: 'bp1', title: 'Alt Title', state: 'PUBLISHED' }),
      json: async () => ({ id: 'bp1', title: 'Alt Title', state: 'PUBLISHED' })
    }));
    const result = await handler('hubspot_get_blog_post')({ postId: 'bp1' });
    assert.ok(result.includes('Alt Title'));
    assert.ok(result.includes('PUBLISHED'));
  });

  it('blog post without optional fields omits them', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: 'bp1', name: 'Minimal' }),
      json: async () => ({ id: 'bp1', name: 'Minimal' })
    }));
    const result = await handler('hubspot_get_blog_post')({ postId: 'bp1' });
    assert.ok(result.includes('Minimal'));
    assert.ok(!result.includes('Author:'));
    assert.ok(!result.includes('Slug:'));
    assert.ok(!result.includes('URL:'));
    assert.ok(!result.includes('Meta:'));
  });
});

// ---------------------------------------------------------------------------
// Empty results with null/undefined
// ---------------------------------------------------------------------------
describe('empty results handling', () => {
  it('list_marketing_emails with null results', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: null }),
      json: async () => ({ results: null })
    }));
    const result = await handler('hubspot_list_marketing_emails')({});
    assert.equal(result, 'No marketing emails found.');
  });

  it('list_campaigns with undefined results', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({}),
      json: async () => ({})
    }));
    const result = await handler('hubspot_list_campaigns')({});
    assert.equal(result, 'No campaigns found.');
  });

  it('list_forms with empty array', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_list_forms')({});
    assert.equal(result, 'No forms found.');
  });

  it('list_landing_pages with empty array', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_list_landing_pages')({});
    assert.equal(result, 'No landing pages found.');
  });

  it('list_blog_posts with empty array', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_list_blog_posts')({});
    assert.equal(result, 'No blog posts found.');
  });

  it('get_form_submissions with empty array', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ results: [] }),
      json: async () => ({ results: [] })
    }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.equal(result, 'No submissions found.');
  });
});

// ---------------------------------------------------------------------------
// HTTP method verification
// ---------------------------------------------------------------------------
describe('HTTP methods', () => {
  it('all list/get tools use GET method', async () => {
    const getTools = [
      ['hubspot_list_marketing_emails', {}],
      ['hubspot_list_campaigns', {}],
      ['hubspot_list_forms', {}],
      ['hubspot_list_landing_pages', {}],
      ['hubspot_list_blog_posts', {}],
      ['hubspot_get_marketing_email', { emailId: 'e1' }],
      ['hubspot_get_campaign', { campaignId: 'c1' }],
      ['hubspot_get_form', { formId: 'f1' }],
      ['hubspot_get_blog_post', { postId: 'bp1' }],
      ['hubspot_get_form_submissions', { formId: 'f1' }],
    ];
    for (const [toolName, params] of getTools) {
      let capturedMethod;
      mock.method(globalThis, 'fetch', async (url, opts) => {
        capturedMethod = opts.method;
        return {
          ok: true, status: 200,
          text: async () => JSON.stringify({ results: [], id: '1', name: 'T' }),
          json: async () => ({ results: [], id: '1', name: 'T' })
        };
      });
      await handler(toolName)(params);
      assert.equal(capturedMethod, 'GET', `${toolName} should use GET, got ${capturedMethod}`);
      mock.restoreAll();
    }
  });
});
