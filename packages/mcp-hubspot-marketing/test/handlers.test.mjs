import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'hubspot.json');
const BACKUP_PATH = CONFIG_PATH + '.marketing-handler-test-backup';

let tools;
let toolMap;

function fakeFetch(data, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data
  });
}

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
// hubspot_list_marketing_emails
// ---------------------------------------------------------------------------
describe('hubspot_list_marketing_emails handler', () => {
  it('returns formatted email list with stats', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{
        id: 'e1', name: 'Welcome Email', subject: 'Welcome!', state: 'PUBLISHED',
        statistics: { counters: { sent: 1000, open: 500, click: 100 } }
      }]
    }));
    const result = await handler('hubspot_list_marketing_emails')({});
    assert.ok(result.includes('Welcome Email'));
    assert.ok(result.includes('Welcome!'));
    assert.ok(result.includes('PUBLISHED'));
    assert.ok(result.includes('sent: 1000'));
    assert.ok(result.includes('opened: 500'));
    assert.ok(result.includes('clicked: 100'));
    assert.ok(result.includes('[id: e1]'));
  });

  it('returns message when no emails found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_marketing_emails')({});
    assert.equal(result, 'No marketing emails found.');
  });

  it('handles email without statistics', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{ id: 'e2', name: 'Draft Email', state: 'DRAFT' }]
    }));
    const result = await handler('hubspot_list_marketing_emails')({});
    assert.ok(result.includes('Draft Email'));
    assert.ok(result.includes('DRAFT'));
    assert.ok(!result.includes('Stats:'));
  });

  it('sends Bearer token auth header', async () => {
    let capturedAuth;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedAuth = opts.headers['Authorization'];
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_marketing_emails')({});
    assert.ok(capturedAuth.startsWith('Bearer '), 'Authorization header should start with Bearer');
  });

  it('calls correct GET URL', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_marketing_emails')({ limit: 10 });
    assert.ok(capturedUrl.includes('https://api.hubapi.com/marketing/v3/emails'));
    assert.ok(capturedUrl.includes('limit=10'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_marketing_email
// ---------------------------------------------------------------------------
describe('hubspot_get_marketing_email handler', () => {
  it('returns full email details with counters and ratios', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: 'e1', name: 'Welcome', subject: 'Hi!', state: 'PUBLISHED', type: 'REGULAR',
      publishDate: '2026-01-15',
      statistics: {
        counters: { sent: 1000, open: 500 },
        ratios: { openratio: 0.5, clickratio: 0.1 }
      }
    }));
    const result = await handler('hubspot_get_marketing_email')({ emailId: 'e1' });
    assert.ok(result.includes('Welcome'));
    assert.ok(result.includes('Hi!'));
    assert.ok(result.includes('PUBLISHED'));
    assert.ok(result.includes('REGULAR'));
    assert.ok(result.includes('2026-01-15'));
    assert.ok(result.includes('sent: 1000'));
    assert.ok(result.includes('open: 500'));
    assert.ok(result.includes('50.0%'));
    assert.ok(result.includes('10.0%'));
    assert.ok(result.includes('[id: e1]'));
  });

  it('handles email without statistics', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: 'e2', name: 'Draft', state: 'DRAFT'
    }));
    const result = await handler('hubspot_get_marketing_email')({ emailId: 'e2' });
    assert.ok(result.includes('Draft'));
    assert.ok(result.includes('[id: e2]'));
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'e1', name: 'T' }), json: async () => ({ id: 'e1', name: 'T' }) };
    });
    await handler('hubspot_get_marketing_email')({ emailId: 'e123' });
    assert.ok(capturedUrl.includes('/marketing/v3/emails/e123'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_campaigns
// ---------------------------------------------------------------------------
describe('hubspot_list_campaigns handler', () => {
  it('returns formatted campaign list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: 'c1', name: 'Spring Sale', state: 'ACTIVE' },
        { id: 'c2', name: 'Fall Promo', status: 'COMPLETED' }
      ]
    }));
    const result = await handler('hubspot_list_campaigns')({});
    assert.ok(result.includes('Spring Sale'));
    assert.ok(result.includes('ACTIVE'));
    assert.ok(result.includes('[id: c1]'));
    assert.ok(result.includes('Fall Promo'));
    assert.ok(result.includes('COMPLETED'));
  });

  it('returns message when no campaigns found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_campaigns')({});
    assert.equal(result, 'No campaigns found.');
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_campaigns')({ limit: 5 });
    assert.ok(capturedUrl.includes('/marketing/v3/campaigns'));
    assert.ok(capturedUrl.includes('limit=5'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_campaign
// ---------------------------------------------------------------------------
describe('hubspot_get_campaign handler', () => {
  it('returns campaign details with non-object properties', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: 'c1', name: 'Spring Sale', state: 'ACTIVE', budget: 5000, startDate: '2026-03-01'
    }));
    const result = await handler('hubspot_get_campaign')({ campaignId: 'c1' });
    assert.ok(result.includes('Spring Sale'));
    assert.ok(result.includes('state: ACTIVE'));
    assert.ok(result.includes('budget: 5000'));
    assert.ok(result.includes('startDate: 2026-03-01'));
    assert.ok(result.includes('[id: c1]'));
  });

  it('skips object-type properties', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: 'c1', name: 'Test', nested: { deep: 'value' }, simple: 'yes'
    }));
    const result = await handler('hubspot_get_campaign')({ campaignId: 'c1' });
    assert.ok(result.includes('simple: yes'));
    assert.ok(!result.includes('nested'));
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'c1', name: 'T' }), json: async () => ({ id: 'c1', name: 'T' }) };
    });
    await handler('hubspot_get_campaign')({ campaignId: 'c999' });
    assert.ok(capturedUrl.includes('/marketing/v3/campaigns/c999'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_forms
// ---------------------------------------------------------------------------
describe('hubspot_list_forms handler', () => {
  it('returns formatted form list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: 'f1', name: 'Contact Form' },
        { id: 'f2', name: 'Newsletter Signup' }
      ]
    }));
    const result = await handler('hubspot_list_forms')({});
    assert.ok(result.includes('Contact Form'));
    assert.ok(result.includes('[id: f1]'));
    assert.ok(result.includes('Newsletter Signup'));
    assert.ok(result.includes('[id: f2]'));
  });

  it('returns message when no forms found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_forms')({});
    assert.equal(result, 'No forms found.');
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_forms')({});
    assert.ok(capturedUrl.includes('/marketing/v3/forms'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_form
// ---------------------------------------------------------------------------
describe('hubspot_get_form handler', () => {
  it('returns full form details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: 'f1', name: 'Contact Form', formType: 'EMBEDDED',
      createdAt: '2026-01-01', updatedAt: '2026-03-01',
      fieldGroups: [{ fields: [{ name: 'email' }] }, { fields: [{ name: 'name' }] }]
    }));
    const result = await handler('hubspot_get_form')({ formId: 'f1' });
    assert.ok(result.includes('Contact Form'));
    assert.ok(result.includes('EMBEDDED'));
    assert.ok(result.includes('2026-01-01'));
    assert.ok(result.includes('2026-03-01'));
    assert.ok(result.includes('2 group(s)'));
    assert.ok(result.includes('[id: f1]'));
  });

  it('handles form without fieldGroups', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ id: 'f2', name: 'Empty Form' }));
    const result = await handler('hubspot_get_form')({ formId: 'f2' });
    assert.ok(result.includes('Empty Form'));
    assert.ok(!result.includes('Fields:'));
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'f1', name: 'T' }), json: async () => ({ id: 'f1', name: 'T' }) };
    });
    await handler('hubspot_get_form')({ formId: 'f456' });
    assert.ok(capturedUrl.includes('/marketing/v3/forms/f456'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_form_submissions
// ---------------------------------------------------------------------------
describe('hubspot_get_form_submissions handler', () => {
  it('returns formatted submissions', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{
        submittedAt: 1711800000000,
        values: [
          { name: 'email', value: 'user@test.com' },
          { name: 'firstname', value: 'Jane' }
        ]
      }]
    }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.ok(result.includes('Submission 1'));
    assert.ok(result.includes('email: user@test.com'));
    assert.ok(result.includes('firstname: Jane'));
  });

  it('returns message when no submissions found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.equal(result, 'No submissions found.');
  });

  it('calls correct API path (v1 form-integrations)', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_get_form_submissions')({ formId: 'f1', limit: 10 });
    assert.ok(capturedUrl.includes('/form-integrations/v1/submissions/forms/f1'));
    assert.ok(capturedUrl.includes('limit=10'));
  });

  it('handles submission without values', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [{ submittedAt: 1711800000000 }]
    }));
    const result = await handler('hubspot_get_form_submissions')({ formId: 'f1' });
    assert.ok(result.includes('Submission 1'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_landing_pages
// ---------------------------------------------------------------------------
describe('hubspot_list_landing_pages handler', () => {
  it('returns formatted landing page list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: 'lp1', name: 'Product Page', state: 'PUBLISHED' },
        { id: 'lp2', title: 'Promo Page', state: 'DRAFT' }
      ]
    }));
    const result = await handler('hubspot_list_landing_pages')({});
    assert.ok(result.includes('Product Page'));
    assert.ok(result.includes('PUBLISHED'));
    assert.ok(result.includes('[id: lp1]'));
    assert.ok(result.includes('Promo Page'));
    assert.ok(result.includes('DRAFT'));
  });

  it('returns message when no landing pages found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_landing_pages')({});
    assert.equal(result, 'No landing pages found.');
  });

  it('calls correct CMS API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_landing_pages')({});
    assert.ok(capturedUrl.includes('/cms/v3/pages/landing-pages'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_list_blog_posts
// ---------------------------------------------------------------------------
describe('hubspot_list_blog_posts handler', () => {
  it('returns formatted blog post list', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      results: [
        { id: 'bp1', name: 'First Post', state: 'PUBLISHED', publishDate: '2026-01-15' },
        { id: 'bp2', title: 'Second Post', state: 'DRAFT' }
      ]
    }));
    const result = await handler('hubspot_list_blog_posts')({});
    assert.ok(result.includes('First Post'));
    assert.ok(result.includes('PUBLISHED'));
    assert.ok(result.includes('2026-01-15'));
    assert.ok(result.includes('[id: bp1]'));
    assert.ok(result.includes('Second Post'));
    assert.ok(result.includes('DRAFT'));
  });

  it('returns message when no blog posts found', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ results: [] }));
    const result = await handler('hubspot_list_blog_posts')({});
    assert.equal(result, 'No blog posts found.');
  });

  it('calls correct CMS API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }), json: async () => ({ results: [] }) };
    });
    await handler('hubspot_list_blog_posts')({});
    assert.ok(capturedUrl.includes('/cms/v3/blogs/posts'));
  });
});

// ---------------------------------------------------------------------------
// hubspot_get_blog_post
// ---------------------------------------------------------------------------
describe('hubspot_get_blog_post handler', () => {
  it('returns full blog post details', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({
      id: 'bp1', name: 'First Post', state: 'PUBLISHED', publishDate: '2026-01-15',
      authorName: 'Jane Doe', slug: 'first-post',
      metaDescription: 'A great post', url: 'https://blog.example.com/first-post'
    }));
    const result = await handler('hubspot_get_blog_post')({ postId: 'bp1' });
    assert.ok(result.includes('First Post'));
    assert.ok(result.includes('PUBLISHED'));
    assert.ok(result.includes('2026-01-15'));
    assert.ok(result.includes('Jane Doe'));
    assert.ok(result.includes('first-post'));
    assert.ok(result.includes('A great post'));
    assert.ok(result.includes('https://blog.example.com/first-post'));
    assert.ok(result.includes('[id: bp1]'));
  });

  it('handles blog post with minimal fields', async () => {
    mock.method(globalThis, 'fetch', fakeFetch({ id: 'bp2' }));
    const result = await handler('hubspot_get_blog_post')({ postId: 'bp2' });
    assert.ok(result.includes('Untitled'));
    assert.ok(result.includes('[id: bp2]'));
  });

  it('calls correct API path', async () => {
    let capturedUrl;
    mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'bp1' }), json: async () => ({ id: 'bp1' }) };
    });
    await handler('hubspot_get_blog_post')({ postId: 'bp789' });
    assert.ok(capturedUrl.includes('/cms/v3/blogs/posts/bp789'));
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('hubspot-marketing error handling', () => {
  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({})
    }));
    await assert.rejects(
      () => handler('hubspot_list_marketing_emails')({}),
      (err) => { assert.ok(err.message.includes('HubSpot API 401')); return true; }
    );
  });

  it('throws on 404 not found', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({})
    }));
    await assert.rejects(
      () => handler('hubspot_get_marketing_email')({ emailId: 'gone' }),
      (err) => { assert.ok(err.message.includes('HubSpot API 404')); return true; }
    );
  });

  it('throws on 500 server error', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({})
    }));
    await assert.rejects(
      () => handler('hubspot_list_campaigns')({}),
      (err) => { assert.ok(err.message.includes('HubSpot API 500')); return true; }
    );
  });

  it('throws on 403 forbidden for forms', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 403,
      text: async () => 'Forbidden',
      json: async () => ({})
    }));
    await assert.rejects(
      () => handler('hubspot_list_forms')({}),
      (err) => { assert.ok(err.message.includes('HubSpot API 403')); return true; }
    );
  });

  it('throws on 429 rate limit for blog posts', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 429,
      text: async () => 'Rate limit exceeded',
      json: async () => ({})
    }));
    await assert.rejects(
      () => handler('hubspot_list_blog_posts')({}),
      (err) => { assert.ok(err.message.includes('HubSpot API 429')); return true; }
    );
  });
});
