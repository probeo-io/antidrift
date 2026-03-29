import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'hubspot.json'), 'utf8'));

async function hubspot(method, path, body) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${err}`);
  }
  return res.json();
}

export const tools = [
  {
    name: 'hubspot_list_marketing_emails',
    description: 'List marketing emails in HubSpot.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await hubspot('GET', `/marketing/v3/emails?limit=${limit}`);
      if (!res.results?.length) return 'No marketing emails found.';
      return res.results.map(record => {
        const lines = [];
        lines.push(`\ud83d\udce7 ${record.name || 'Untitled'}`);
        if (record.subject) lines.push(`  Subject: ${record.subject}`);
        if (record.state) lines.push(`  Status: ${record.state}`);
        if (record.statistics) {
          const s = record.statistics;
          const stats = [];
          if (s.counters?.sent) stats.push(`sent: ${s.counters.sent}`);
          if (s.counters?.open) stats.push(`opened: ${s.counters.open}`);
          if (s.counters?.click) stats.push(`clicked: ${s.counters.click}`);
          if (stats.length) lines.push(`  Stats: ${stats.join(', ')}`);
        }
        lines.push(`  [id: ${record.id}]`);
        return lines.join('\n');
      }).join('\n\n');
    }
  },
  {
    name: 'hubspot_get_marketing_email',
    description: 'Get full details and stats for a marketing email by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: { type: 'string', description: 'The marketing email ID' }
      },
      required: ['emailId']
    },
    handler: async ({ emailId }) => {
      const res = await hubspot('GET', `/marketing/v3/emails/${emailId}`);
      const lines = [];
      lines.push(`\ud83d\udce7 ${res.name || 'Untitled'}`);
      if (res.subject) lines.push(`Subject: ${res.subject}`);
      if (res.state) lines.push(`Status: ${res.state}`);
      if (res.type) lines.push(`Type: ${res.type}`);
      if (res.publishDate) lines.push(`Published: ${res.publishDate}`);
      if (res.statistics) {
        const s = res.statistics;
        if (s.counters) {
          for (const [key, value] of Object.entries(s.counters)) {
            if (value != null) lines.push(`  ${key}: ${value}`);
          }
        }
        if (s.ratios) {
          for (const [key, value] of Object.entries(s.ratios)) {
            if (value != null) lines.push(`  ${key}: ${(value * 100).toFixed(1)}%`);
          }
        }
      }
      lines.push(`[id: ${emailId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_list_campaigns',
    description: 'List marketing campaigns in HubSpot.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await hubspot('GET', `/marketing/v3/campaigns?limit=${limit}`);
      if (!res.results?.length) return 'No campaigns found.';
      return res.results.map(record => {
        const status = record.state || record.status || '';
        let line = `\ud83d\udce7 ${record.name || 'Untitled'}`;
        if (status) line += ` \u2014 ${status}`;
        line += ` [id: ${record.id}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'hubspot_get_campaign',
    description: 'Get full details for a marketing campaign by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The campaign ID' }
      },
      required: ['campaignId']
    },
    handler: async ({ campaignId }) => {
      const res = await hubspot('GET', `/marketing/v3/campaigns/${campaignId}`);
      const lines = [];
      lines.push(`\ud83d\udce7 ${res.name || 'Untitled'}`);
      for (const [key, value] of Object.entries(res)) {
        if (key === 'name' || key === 'id') continue;
        if (value != null && value !== '' && typeof value !== 'object') {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push(`[id: ${campaignId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_list_forms',
    description: 'List forms in HubSpot.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await hubspot('GET', `/marketing/v3/forms?limit=${limit}`);
      if (!res.results?.length) return 'No forms found.';
      return res.results.map(record => {
        return `\ud83d\udccb ${record.name || 'Untitled'} [id: ${record.id}]`;
      }).join('\n');
    }
  },
  {
    name: 'hubspot_get_form',
    description: 'Get full details for a form by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'The form ID' }
      },
      required: ['formId']
    },
    handler: async ({ formId }) => {
      const res = await hubspot('GET', `/marketing/v3/forms/${formId}`);
      const lines = [];
      lines.push(`\ud83d\udccb ${res.name || 'Untitled'}`);
      if (res.formType) lines.push(`Type: ${res.formType}`);
      if (res.createdAt) lines.push(`Created: ${res.createdAt}`);
      if (res.updatedAt) lines.push(`Updated: ${res.updatedAt}`);
      if (res.fieldGroups?.length) {
        lines.push(`Fields: ${res.fieldGroups.length} group(s)`);
      }
      lines.push(`[id: ${formId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_get_form_submissions',
    description: 'Get submissions for a form.',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'The form ID' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['formId']
    },
    handler: async ({ formId, limit = 20 }) => {
      const res = await hubspot('GET', `/form-integrations/v1/submissions/forms/${formId}?limit=${limit}`);
      if (!res.results?.length) return 'No submissions found.';
      return res.results.map((sub, i) => {
        const lines = [`Submission ${i + 1}`];
        if (sub.submittedAt) lines.push(`  Submitted: ${new Date(sub.submittedAt).toLocaleString()}`);
        if (sub.values?.length) {
          for (const v of sub.values) {
            lines.push(`  ${v.name}: ${v.value}`);
          }
        }
        return lines.join('\n');
      }).join('\n\n');
    }
  },
  {
    name: 'hubspot_list_landing_pages',
    description: 'List landing pages in HubSpot.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await hubspot('GET', `/cms/v3/pages/landing-pages?limit=${limit}`);
      if (!res.results?.length) return 'No landing pages found.';
      return res.results.map(record => {
        let line = `\ud83d\udcc4 ${record.name || record.title || 'Untitled'}`;
        if (record.state) line += ` \u2014 ${record.state}`;
        line += ` [id: ${record.id}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'hubspot_list_blog_posts',
    description: 'List blog posts in HubSpot.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await hubspot('GET', `/cms/v3/blogs/posts?limit=${limit}`);
      if (!res.results?.length) return 'No blog posts found.';
      return res.results.map(record => {
        let line = `\ud83d\udcdd ${record.name || record.title || 'Untitled'}`;
        if (record.state) line += ` \u2014 ${record.state}`;
        if (record.publishDate) line += `, ${record.publishDate}`;
        line += ` [id: ${record.id}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'hubspot_get_blog_post',
    description: 'Get full details for a blog post by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'The blog post ID' }
      },
      required: ['postId']
    },
    handler: async ({ postId }) => {
      const res = await hubspot('GET', `/cms/v3/blogs/posts/${postId}`);
      const lines = [];
      lines.push(`\ud83d\udcdd ${res.name || res.title || 'Untitled'}`);
      if (res.state) lines.push(`State: ${res.state}`);
      if (res.publishDate) lines.push(`Published: ${res.publishDate}`);
      if (res.authorName) lines.push(`Author: ${res.authorName}`);
      if (res.slug) lines.push(`Slug: ${res.slug}`);
      if (res.metaDescription) lines.push(`Meta: ${res.metaDescription}`);
      if (res.url) lines.push(`URL: ${res.url}`);
      lines.push(`[id: ${postId}]`);
      return lines.join('\n');
    }
  }
];
