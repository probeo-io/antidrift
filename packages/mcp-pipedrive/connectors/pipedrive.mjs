import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'pipedrive.json'), 'utf8'));
const BASE = `https://${config.domain}.pipedrive.com/api/v1`;

async function pd(method, path, body) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_token', config.apiToken);

  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pipedrive API ${res.status}: ${err}`);
  }
  return res.json();
}

function formatDeal(deal) {
  let line = `${deal.title}`;
  if (deal.stage_id) line += `  [stage: ${deal.stage_id}]`;
  if (deal.value) line += `  $${deal.value} ${deal.currency || ''}`;
  if (deal.person_name) line += `  → ${deal.person_name}`;
  if (deal.status) line += `  (${deal.status})`;
  line += `  [id: ${deal.id}]`;
  return line;
}

function formatPerson(person) {
  let line = `${person.name}`;
  if (person.email?.length) line += `  ${person.email[0].value}`;
  if (person.phone?.length) line += `  ${person.phone[0].value}`;
  if (person.org_name) line += `  @ ${person.org_name}`;
  line += `  [id: ${person.id}]`;
  return line;
}

function formatOrg(org) {
  let line = `${org.name}`;
  if (org.address) line += `  ${org.address}`;
  line += `  [id: ${org.id}]`;
  return line;
}

export const tools = [
  {
    name: 'pipedrive_list_deals',
    description: 'List deals in Pipedrive with optional status filter.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: open, won, lost, deleted (default: open)' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ status = 'open', limit = 20 }) => {
      const res = await pd('GET', `/deals?status=${status}&limit=${limit}&sort=update_time DESC`);
      if (!res.data?.length) return 'No deals found.';
      return res.data.map(formatDeal).join('\n');
    }
  },
  {
    name: 'pipedrive_get_deal',
    description: 'Get full details for a deal by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Deal ID' }
      },
      required: ['id']
    },
    handler: async ({ id }) => {
      const res = await pd('GET', `/deals/${id}`);
      const d = res.data;
      const lines = [];
      lines.push(`${d.title}  [${d.status}]`);
      if (d.value) lines.push(`Value: $${d.value} ${d.currency || ''}`);
      if (d.person_name) lines.push(`Contact: ${d.person_name}`);
      if (d.org_name) lines.push(`Organization: ${d.org_name}`);
      if (d.pipeline_id) lines.push(`Pipeline: ${d.pipeline_id}`);
      if (d.stage_id) lines.push(`Stage: ${d.stage_id}`);
      if (d.expected_close_date) lines.push(`Expected close: ${d.expected_close_date}`);
      if (d.owner_name) lines.push(`Owner: ${d.owner_name}`);
      lines.push(`Created: ${d.add_time}`);
      lines.push(`[id: ${d.id}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'pipedrive_create_deal',
    description: 'Create a new deal in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deal title' },
        value: { type: 'number', description: 'Deal value' },
        currency: { type: 'string', description: 'Currency code (default: USD)' },
        personId: { type: 'number', description: 'Contact person ID' },
        orgId: { type: 'number', description: 'Organization ID' }
      },
      required: ['title']
    },
    handler: async ({ title, value, currency, personId, orgId }) => {
      const body = { title };
      if (value) body.value = value;
      if (currency) body.currency = currency;
      if (personId) body.person_id = personId;
      if (orgId) body.org_id = orgId;
      const res = await pd('POST', '/deals', body);
      return `Created deal: ${res.data.title}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'pipedrive_update_deal',
    description: 'Update a deal in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Deal ID' },
        title: { type: 'string', description: 'New title' },
        value: { type: 'number', description: 'New value' },
        status: { type: 'string', description: 'Status: open, won, lost' },
        stageId: { type: 'number', description: 'Stage ID to move to' }
      },
      required: ['id']
    },
    handler: async ({ id, title, value, status, stageId }) => {
      const body = {};
      if (title) body.title = title;
      if (value) body.value = value;
      if (status) body.status = status;
      if (stageId) body.stage_id = stageId;
      const res = await pd('PUT', `/deals/${id}`, body);
      return `Updated deal: ${res.data.title}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'pipedrive_search_deals',
    description: 'Search deals by title.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['query']
    },
    handler: async ({ query, limit = 20 }) => {
      const res = await pd('GET', `/deals/search?term=${encodeURIComponent(query)}&limit=${limit}`);
      if (!res.data?.items?.length) return `No deals matching "${query}".`;
      return res.data.items.map(i => formatDeal(i.item)).join('\n');
    }
  },
  {
    name: 'pipedrive_list_persons',
    description: 'List contacts in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await pd('GET', `/persons?limit=${limit}&sort=update_time DESC`);
      if (!res.data?.length) return 'No contacts found.';
      return res.data.map(formatPerson).join('\n');
    }
  },
  {
    name: 'pipedrive_get_person',
    description: 'Get full details for a contact by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Person ID' }
      },
      required: ['id']
    },
    handler: async ({ id }) => {
      const res = await pd('GET', `/persons/${id}`);
      const p = res.data;
      const lines = [];
      lines.push(p.name);
      if (p.email?.length) lines.push(`Email: ${p.email.map(e => e.value).join(', ')}`);
      if (p.phone?.length) lines.push(`Phone: ${p.phone.map(ph => ph.value).join(', ')}`);
      if (p.org_name) lines.push(`Organization: ${p.org_name}`);
      if (p.owner_name) lines.push(`Owner: ${p.owner_name}`);
      lines.push(`Open deals: ${p.open_deals_count || 0}`);
      lines.push(`[id: ${p.id}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'pipedrive_create_person',
    description: 'Create a new contact in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Contact name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        orgId: { type: 'number', description: 'Organization ID to link to' }
      },
      required: ['name']
    },
    handler: async ({ name, email, phone, orgId }) => {
      const body = { name };
      if (email) body.email = [{ value: email, primary: true }];
      if (phone) body.phone = [{ value: phone, primary: true }];
      if (orgId) body.org_id = orgId;
      const res = await pd('POST', '/persons', body);
      return `Created contact: ${res.data.name}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'pipedrive_search_persons',
    description: 'Search contacts by name, email, or phone.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' }
      },
      required: ['query']
    },
    handler: async ({ query }) => {
      const res = await pd('GET', `/persons/search?term=${encodeURIComponent(query)}`);
      if (!res.data?.items?.length) return `No contacts matching "${query}".`;
      return res.data.items.map(i => formatPerson(i.item)).join('\n');
    }
  },
  {
    name: 'pipedrive_list_organizations',
    description: 'List organizations in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await pd('GET', `/organizations?limit=${limit}&sort=update_time DESC`);
      if (!res.data?.length) return 'No organizations found.';
      return res.data.map(formatOrg).join('\n');
    }
  },
  {
    name: 'pipedrive_create_organization',
    description: 'Create a new organization in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Organization name' },
        address: { type: 'string', description: 'Address (optional)' }
      },
      required: ['name']
    },
    handler: async ({ name, address }) => {
      const body = { name };
      if (address) body.address = address;
      const res = await pd('POST', '/organizations', body);
      return `Created organization: ${res.data.name}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'pipedrive_list_activities',
    description: 'List activities (calls, meetings, tasks, emails) in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Activity type: call, meeting, task, email, lunch, deadline' },
        done: { type: 'number', description: '0 for open, 1 for done' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ type, done, limit = 20 }) => {
      let path = `/activities?limit=${limit}`;
      if (type) path += `&type=${type}`;
      if (done !== undefined) path += `&done=${done}`;
      const res = await pd('GET', path);
      if (!res.data?.length) return 'No activities found.';
      return res.data.map(a => {
        let line = `${a.done ? '✓' : '○'} ${a.type}: ${a.subject}`;
        if (a.due_date) line += `  (${a.due_date})`;
        if (a.person_name) line += `  → ${a.person_name}`;
        line += `  [id: ${a.id}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'pipedrive_create_activity',
    description: 'Create an activity (call, meeting, task) in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Activity subject' },
        type: { type: 'string', description: 'Type: call, meeting, task, email, lunch, deadline' },
        dueDate: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
        dealId: { type: 'number', description: 'Link to deal ID' },
        personId: { type: 'number', description: 'Link to person ID' }
      },
      required: ['subject', 'type']
    },
    handler: async ({ subject, type, dueDate, dealId, personId }) => {
      const body = { subject, type };
      if (dueDate) body.due_date = dueDate;
      if (dealId) body.deal_id = dealId;
      if (personId) body.person_id = personId;
      const res = await pd('POST', '/activities', body);
      return `Created ${type}: ${subject}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'pipedrive_add_note',
    description: 'Add a note to a deal, person, or organization in Pipedrive.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Note content (HTML supported)' },
        dealId: { type: 'number', description: 'Deal ID to attach to' },
        personId: { type: 'number', description: 'Person ID to attach to' },
        orgId: { type: 'number', description: 'Organization ID to attach to' }
      },
      required: ['content']
    },
    handler: async ({ content, dealId, personId, orgId }) => {
      const body = { content };
      if (dealId) body.deal_id = dealId;
      if (personId) body.person_id = personId;
      if (orgId) body.org_id = orgId;
      const res = await pd('POST', '/notes', body);
      return `Note added  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'pipedrive_list_pipelines',
    description: 'List all sales pipelines and their stages.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const res = await pd('GET', '/pipelines');
      if (!res.data?.length) return 'No pipelines found.';
      const lines = [];
      for (const p of res.data) {
        lines.push(`${p.name}  [id: ${p.id}]`);
        const stages = await pd('GET', `/stages?pipeline_id=${p.id}`);
        if (stages.data?.length) {
          stages.data.forEach(s => lines.push(`  ${s.order_nr}. ${s.name}  [id: ${s.id}]`));
        }
      }
      return lines.join('\n');
    }
  }
];
