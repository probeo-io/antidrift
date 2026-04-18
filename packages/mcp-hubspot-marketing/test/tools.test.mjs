/**
 * Comprehensive unit tests for mcp-hubspot-marketing tools
 * Tests all tools/*.mjs files and lib/client.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeCtx(responseData, opts = {}) {
  const { ok = true, status = 200, responses = null } = opts;
  const calls = [];

  const fetch = async (url, reqOpts) => {
    calls.push({ url, opts: reqOpts });
    let data = responseData;
    if (responses && calls.length <= responses.length) {
      data = responses[calls.length - 1];
    }
    return {
      ok,
      status,
      text: async () => JSON.stringify(data),
      json: async () => data,
    };
  };

  return {
    ctx: { credentials: { accessToken: 'test-access-token' }, fetch },
    getCalls: () => calls,
    getCall: (i = 0) => calls[i],
  };
}

function makeErrCtx(status = 400, message = 'Bad Request') {
  return makeCtx({ message }, { ok: false, status });
}

// ---------------------------------------------------------------------------
// lib/client.mjs
// ---------------------------------------------------------------------------

describe('lib/client.mjs — createClient', async () => {
  const { createClient } = await import('../lib/client.mjs');

  it('sends Authorization Bearer header', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/marketing/v3/emails');
    assert.equal(getCall().opts.headers['Authorization'], 'Bearer test-access-token');
  });

  it('sends Content-Type application/json', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/marketing/v3/emails');
    assert.equal(getCall().opts.headers['Content-Type'], 'application/json');
  });

  it('builds correct URL from path', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/marketing/v3/campaigns?limit=5');
    assert.ok(getCall().url.startsWith('https://api.hubapi.com'));
    assert.ok(getCall().url.includes('/marketing/v3/campaigns'));
  });

  it('serializes body as JSON for POST', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('POST', '/marketing/v3/emails', { name: 'test' });
    const parsed = JSON.parse(getCall().opts.body);
    assert.equal(parsed.name, 'test');
  });

  it('omits body for GET requests', async () => {
    const { ctx, getCall } = makeCtx({});
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await hubspot('GET', '/marketing/v3/emails');
    assert.equal(getCall().opts.body, undefined);
  });

  it('throws on non-ok response with status code', async () => {
    const { ctx } = makeErrCtx(401, 'Unauthorized');
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => hubspot('GET', '/marketing/v3/emails'), /HubSpot API 401/);
  });

  it('throws on 500 error', async () => {
    const { ctx } = makeErrCtx(500);
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => hubspot('GET', '/marketing/v3/emails'), /HubSpot API 500/);
  });

  it('throws on 403 with status code in message', async () => {
    const { ctx } = makeErrCtx(403, 'Forbidden');
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    await assert.rejects(() => hubspot('GET', '/marketing/v3/emails'), /403/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_marketing_emails.mjs
// ---------------------------------------------------------------------------

describe('tools/list_marketing_emails.mjs', async () => {
  const tool = (await import('../tools/list_marketing_emails.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 0);
    assert.equal(typeof tool.input, 'object');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /marketing/v3/emails with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/marketing/v3/emails'));
    assert.ok(getCall().url.includes('limit=10'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns "No marketing emails found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No marketing emails found.');
  });

  it('returns formatted email records', async () => {
    const results = [
      { id: 'e1', name: 'Welcome Email', subject: 'Hello!', state: 'PUBLISHED' },
      { id: 'e2', name: 'Newsletter', subject: 'Monthly Update', state: 'DRAFT' },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Welcome Email'));
    assert.ok(out.includes('Hello!'));
    assert.ok(out.includes('PUBLISHED'));
    assert.ok(out.includes('Newsletter'));
    assert.ok(out.includes('DRAFT'));
    assert.ok(out.includes('[id: e1]'));
  });

  it('includes stats when present', async () => {
    const results = [{
      id: 'e1', name: 'Email', subject: 'Hi',
      statistics: { counters: { sent: 1000, open: 250, click: 50 } }
    }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('sent: 1000'));
    assert.ok(out.includes('opened: 250'));
    assert.ok(out.includes('clicked: 50'));
  });

  it('default limit is 20', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => tool.execute({}, ctx), /HubSpot API 403/);
  });
});

// ---------------------------------------------------------------------------
// tools/get_marketing_email.mjs
// ---------------------------------------------------------------------------

describe('tools/get_marketing_email.mjs', async () => {
  const tool = (await import('../tools/get_marketing_email.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /marketing/v3/emails/:emailId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'e10', name: 'Test' });
    await tool.execute({ emailId: 'e10' }, ctx);
    assert.ok(getCall().url.includes('/marketing/v3/emails/e10'));
    assert.equal(getCall().opts.method, 'GET');
  });

  it('returns email details', async () => {
    const { ctx } = makeCtx({
      id: 'e10', name: 'Spring Campaign', subject: 'Spring is here!',
      state: 'PUBLISHED', type: 'REGULAR', publishDate: '2025-03-01'
    });
    const out = await tool.execute({ emailId: 'e10' }, ctx);
    assert.ok(out.includes('Spring Campaign'));
    assert.ok(out.includes('Spring is here!'));
    assert.ok(out.includes('PUBLISHED'));
    assert.ok(out.includes('REGULAR'));
    assert.ok(out.includes('2025-03-01'));
    assert.ok(out.includes('[id: e10]'));
  });

  it('includes statistics counters and ratios', async () => {
    const { ctx } = makeCtx({
      id: 'e11', name: 'Stats Email',
      statistics: {
        counters: { sent: 500, open: 100 },
        ratios: { openRate: 0.2, clickRate: 0.05 }
      }
    });
    const out = await tool.execute({ emailId: 'e11' }, ctx);
    assert.ok(out.includes('sent: 500'));
    assert.ok(out.includes('open: 100'));
    assert.ok(out.includes('20.0%'));
    assert.ok(out.includes('5.0%'));
  });

  it('handles email with no statistics', async () => {
    const { ctx } = makeCtx({ id: 'e12', name: 'Draft Email', state: 'DRAFT' });
    const out = await tool.execute({ emailId: 'e12' }, ctx);
    assert.ok(out.includes('Draft Email'));
    assert.ok(out.includes('[id: e12]'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ emailId: 'missing' }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_campaigns.mjs
// ---------------------------------------------------------------------------

describe('tools/list_campaigns.mjs', async () => {
  const tool = (await import('../tools/list_campaigns.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /marketing/v3/campaigns with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/marketing/v3/campaigns'));
    assert.ok(getCall().url.includes('limit=5'));
  });

  it('returns "No campaigns found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No campaigns found.');
  });

  it('returns formatted campaign lines', async () => {
    const results = [
      { id: 'c1', name: 'Q1 Push', state: 'ACTIVE' },
      { id: 'c2', name: 'Holiday', status: 'COMPLETED' },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Q1 Push'));
    assert.ok(out.includes('ACTIVE'));
    assert.ok(out.includes('Holiday'));
    assert.ok(out.includes('[id: c1]'));
  });

  it('falls back to status when state is absent', async () => {
    const results = [{ id: 'c3', name: 'Legacy', status: 'DRAFT' }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('DRAFT'));
  });

  it('default limit is 20', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_campaign.mjs
// ---------------------------------------------------------------------------

describe('tools/get_campaign.mjs', async () => {
  const tool = (await import('../tools/get_campaign.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /marketing/v3/campaigns/:campaignId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'c5', name: 'Test' });
    await tool.execute({ campaignId: 'c5' }, ctx);
    assert.ok(getCall().url.includes('/marketing/v3/campaigns/c5'));
  });

  it('returns campaign details', async () => {
    const { ctx } = makeCtx({ id: 'c5', name: 'Summer Sale', startDate: '2025-06-01', budget: '10000' });
    const out = await tool.execute({ campaignId: 'c5' }, ctx);
    assert.ok(out.includes('Summer Sale'));
    assert.ok(out.includes('startDate'));
    assert.ok(out.includes('2025-06-01'));
    assert.ok(out.includes('[id: c5]'));
  });

  it('does not print name twice', async () => {
    const { ctx } = makeCtx({ id: 'c6', name: 'Campaign X' });
    const out = await tool.execute({ campaignId: 'c6' }, ctx);
    const nameCount = (out.match(/Campaign X/g) || []).length;
    assert.equal(nameCount, 1);
  });

  it('skips object-type values', async () => {
    const { ctx } = makeCtx({ id: 'c7', name: 'C7', nested: { foo: 'bar' }, scalar: 'val' });
    const out = await tool.execute({ campaignId: 'c7' }, ctx);
    assert.ok(out.includes('scalar: val'));
    assert.ok(!out.includes('nested'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ campaignId: 'bad' }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_blog_posts.mjs
// ---------------------------------------------------------------------------

describe('tools/list_blog_posts.mjs', async () => {
  const tool = (await import('../tools/list_blog_posts.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /cms/v3/blogs/posts with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/cms/v3/blogs/posts'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns "No blog posts found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No blog posts found.');
  });

  it('returns formatted blog post lines', async () => {
    const results = [
      { id: 'bp1', name: 'Hello World', state: 'PUBLISHED', publishDate: '2025-01-01' },
      { id: 'bp2', title: 'Second Post', state: 'DRAFT' },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Hello World'));
    assert.ok(out.includes('PUBLISHED'));
    assert.ok(out.includes('2025-01-01'));
    assert.ok(out.includes('Second Post'));
    assert.ok(out.includes('[id: bp1]'));
  });

  it('falls back to title when name is absent', async () => {
    const results = [{ id: 'bp3', title: 'Title Only Post', state: 'DRAFT' }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Title Only Post'));
  });

  it('default limit is 20', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_blog_post.mjs
// ---------------------------------------------------------------------------

describe('tools/get_blog_post.mjs', async () => {
  const tool = (await import('../tools/get_blog_post.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /cms/v3/blogs/posts/:postId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'bp10', name: 'Test Post' });
    await tool.execute({ postId: 'bp10' }, ctx);
    assert.ok(getCall().url.includes('/cms/v3/blogs/posts/bp10'));
  });

  it('returns blog post details', async () => {
    const { ctx } = makeCtx({
      id: 'bp10', name: 'Deep Dive Post', state: 'PUBLISHED', publishDate: '2025-02-14',
      authorName: 'Jane Author', slug: 'deep-dive', metaDescription: 'A deep dive',
      url: 'https://blog.ex.com/deep-dive'
    });
    const out = await tool.execute({ postId: 'bp10' }, ctx);
    assert.ok(out.includes('Deep Dive Post'));
    assert.ok(out.includes('PUBLISHED'));
    assert.ok(out.includes('2025-02-14'));
    assert.ok(out.includes('Jane Author'));
    assert.ok(out.includes('deep-dive'));
    assert.ok(out.includes('A deep dive'));
    assert.ok(out.includes('https://blog.ex.com/deep-dive'));
    assert.ok(out.includes('[id: bp10]'));
  });

  it('falls back to title when name missing', async () => {
    const { ctx } = makeCtx({ id: 'bp11', title: 'Title Fallback' });
    const out = await tool.execute({ postId: 'bp11' }, ctx);
    assert.ok(out.includes('Title Fallback'));
  });

  it('handles missing optional fields', async () => {
    const { ctx } = makeCtx({ id: 'bp12', name: 'Minimal' });
    const out = await tool.execute({ postId: 'bp12' }, ctx);
    assert.ok(out.includes('Minimal'));
    assert.ok(out.includes('[id: bp12]'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ postId: 'missing' }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/list_forms.mjs
// ---------------------------------------------------------------------------

describe('tools/list_forms.mjs', async () => {
  const tool = (await import('../tools/list_forms.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /marketing/v3/forms with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 5 }, ctx);
    assert.ok(getCall().url.includes('/marketing/v3/forms'));
    assert.ok(getCall().url.includes('limit=5'));
  });

  it('returns "No forms found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No forms found.');
  });

  it('returns formatted form lines', async () => {
    const results = [
      { id: 'f1', name: 'Contact Form' },
      { id: 'f2', name: 'Newsletter Signup' },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Contact Form'));
    assert.ok(out.includes('[id: f1]'));
    assert.ok(out.includes('Newsletter Signup'));
  });

  it('defaults to Untitled when name missing', async () => {
    const results = [{ id: 'f3' }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Untitled'));
  });

  it('default limit is 20', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({}, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/get_form.mjs
// ---------------------------------------------------------------------------

describe('tools/get_form.mjs', async () => {
  const tool = (await import('../tools/get_form.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /marketing/v3/forms/:formId', async () => {
    const { ctx, getCall } = makeCtx({ id: 'f5', name: 'Lead Form' });
    await tool.execute({ formId: 'f5' }, ctx);
    assert.ok(getCall().url.includes('/marketing/v3/forms/f5'));
  });

  it('returns form details', async () => {
    const { ctx } = makeCtx({
      id: 'f5', name: 'Lead Form', formType: 'hubspot',
      createdAt: '2024-01-01', updatedAt: '2025-01-01',
      fieldGroups: [{ fields: [] }, { fields: [] }]
    });
    const out = await tool.execute({ formId: 'f5' }, ctx);
    assert.ok(out.includes('Lead Form'));
    assert.ok(out.includes('hubspot'));
    assert.ok(out.includes('2024-01-01'));
    assert.ok(out.includes('2025-01-01'));
    assert.ok(out.includes('2 group(s)'));
    assert.ok(out.includes('[id: f5]'));
  });

  it('handles form without fieldGroups', async () => {
    const { ctx } = makeCtx({ id: 'f6', name: 'Simple Form', formType: 'embedded' });
    const out = await tool.execute({ formId: 'f6' }, ctx);
    assert.ok(out.includes('Simple Form'));
    assert.ok(out.includes('[id: f6]'));
    assert.ok(!out.includes('group(s)'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(404);
    await assert.rejects(() => tool.execute({ formId: 'bad' }, ctx), /HubSpot API 404/);
  });
});

// ---------------------------------------------------------------------------
// tools/get_form_submissions.mjs
// ---------------------------------------------------------------------------

describe('tools/get_form_submissions.mjs', async () => {
  const tool = (await import('../tools/get_form_submissions.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /form-integrations/v1/submissions/forms/:formId', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ formId: 'f7', limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/form-integrations/v1/submissions/forms/f7'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns "No submissions found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({ formId: 'f7' }, ctx);
    assert.equal(out, 'No submissions found.');
  });

  it('returns formatted submission data', async () => {
    const results = [{
      submittedAt: 1700000000000,
      values: [
        { name: 'email', value: 'sub@test.com' },
        { name: 'firstname', value: 'Sub' },
      ]
    }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ formId: 'f7' }, ctx);
    assert.ok(out.includes('Submission 1'));
    assert.ok(out.includes('email: sub@test.com'));
    assert.ok(out.includes('firstname: Sub'));
  });

  it('handles multiple submissions', async () => {
    const results = [
      { submittedAt: 1700000000000, values: [{ name: 'email', value: 'a@t.com' }] },
      { submittedAt: 1700000001000, values: [{ name: 'email', value: 'b@t.com' }] },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({ formId: 'f7' }, ctx);
    assert.ok(out.includes('Submission 1'));
    assert.ok(out.includes('Submission 2'));
    assert.ok(out.includes('a@t.com'));
    assert.ok(out.includes('b@t.com'));
  });

  it('defaults limit to 20', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ formId: 'f7' }, ctx);
    assert.ok(getCall().url.includes('limit=20'));
  });
});

// ---------------------------------------------------------------------------
// tools/list_landing_pages.mjs
// ---------------------------------------------------------------------------

describe('tools/list_landing_pages.mjs', async () => {
  const tool = (await import('../tools/list_landing_pages.mjs')).default;

  it('has description, input, execute', () => {
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.execute, 'function');
  });

  it('GETs /cms/v3/pages/landing-pages with limit', async () => {
    const { ctx, getCall } = makeCtx({ results: [] });
    await tool.execute({ limit: 10 }, ctx);
    assert.ok(getCall().url.includes('/cms/v3/pages/landing-pages'));
    assert.ok(getCall().url.includes('limit=10'));
  });

  it('returns "No landing pages found." when empty', async () => {
    const { ctx } = makeCtx({ results: [] });
    const out = await tool.execute({}, ctx);
    assert.equal(out, 'No landing pages found.');
  });

  it('returns formatted landing page lines', async () => {
    const results = [
      { id: 'lp1', name: 'Spring Promo', state: 'PUBLISHED' },
      { id: 'lp2', title: 'Holiday Page', state: 'DRAFT' },
    ];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Spring Promo'));
    assert.ok(out.includes('PUBLISHED'));
    assert.ok(out.includes('Holiday Page'));
    assert.ok(out.includes('[id: lp1]'));
  });

  it('falls back to title when name is absent', async () => {
    const results = [{ id: 'lp3', title: 'Title Only', state: 'DRAFT' }];
    const { ctx } = makeCtx({ results });
    const out = await tool.execute({}, ctx);
    assert.ok(out.includes('Title Only'));
  });

  it('throws on API error', async () => {
    const { ctx } = makeErrCtx(403);
    await assert.rejects(() => tool.execute({}, ctx), /HubSpot API 403/);
  });
});
