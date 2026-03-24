import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'attio.json'), 'utf8'));

async function attio(method, path, body) {
  const res = await fetch(`https://api.attio.com/v2${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Attio API ${res.status}: ${err}`);
  }
  return res.json();
}

function formatPerson(record) {
  const vals = record.values || {};
  const name = vals.name?.[0]?.full_name || vals.name?.[0]?.first_name || 'Unknown';
  const email = vals.email_addresses?.[0]?.email_address || '';
  const company = vals.company?.[0]?.target_object_id ? vals.company[0].target_record_id : '';
  let line = `👤 ${name}`;
  if (email) line += `  •  ${email}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}

function formatCompany(record) {
  const vals = record.values || {};
  const name = vals.name?.[0]?.value || 'Unknown';
  const domain = vals.domains?.[0]?.domain || '';
  let line = `🏢 ${name}`;
  if (domain) line += `  •  ${domain}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}

function formatDeal(record) {
  const vals = record.values || {};
  const name = vals.name?.[0]?.value || 'Unknown';
  const stage = vals.stage?.[0]?.status?.title || '';
  const value = vals.value?.[0]?.currency_value || '';
  let line = `💰 ${name}`;
  if (stage) line += `  •  ${stage}`;
  if (value) line += `  •  $${value}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}

export const tools = [
  {
    name: 'attio_list_people',
    description: 'List people in Attio CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await attio('POST', '/objects/people/records/query', { limit });
      if (!res.data?.length) return 'No people found.';
      return res.data.map(formatPerson).join('\n');
    }
  },
  {
    name: 'attio_search_people',
    description: 'Search for people in Attio by name or email.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or email to search for' }
      },
      required: ['query']
    },
    handler: async ({ query }) => {
      const res = await attio('POST', '/objects/people/records/query', {
        filter: {
          or: [
            { attribute: 'name', condition: 'contains', value: query },
            { attribute: 'email_addresses', condition: 'contains', value: query }
          ]
        }
      });
      if (!res.data?.length) return `No people matching "${query}".`;
      return res.data.map(formatPerson).join('\n');
    }
  },
  {
    name: 'attio_get_person',
    description: 'Get full details for a person by record ID.',
    inputSchema: {
      type: 'object',
      properties: {
        recordId: { type: 'string', description: 'The person record ID' }
      },
      required: ['recordId']
    },
    handler: async ({ recordId }) => {
      const res = await attio('GET', `/objects/people/records/${recordId}`);
      const vals = res.data.values || {};
      const lines = [];
      const name = vals.name?.[0]?.full_name || 'Unknown';
      lines.push(`👤 ${name}`);
      if (vals.email_addresses?.length) lines.push(`📧 ${vals.email_addresses.map(e => e.email_address).join(', ')}`);
      if (vals.phone_numbers?.length) lines.push(`📞 ${vals.phone_numbers.map(p => p.phone_number).join(', ')}`);
      if (vals.job_title?.[0]?.value) lines.push(`💼 ${vals.job_title[0].value}`);
      if (vals.description?.[0]?.value) lines.push(`📝 ${vals.description[0].value}`);
      lines.push(`[id: ${recordId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'attio_create_person',
    description: 'Create a new person in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        jobTitle: { type: 'string', description: 'Job title (optional)' }
      },
      required: ['email']
    },
    handler: async ({ email, firstName, lastName, jobTitle }) => {
      const values = {
        email_addresses: [{ email_address: email }]
      };
      if (firstName || lastName) {
        values.name = [{ first_name: firstName || '', last_name: lastName || '' }];
      }
      if (jobTitle) values.job_title = [{ value: jobTitle }];

      const res = await attio('POST', '/objects/people/records', { data: { values } });
      return `✅ Created ${firstName || ''} ${lastName || ''} (${email})  [id: ${res.data.id.record_id}]`;
    }
  },
  {
    name: 'attio_list_companies',
    description: 'List companies in Attio CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await attio('POST', '/objects/companies/records/query', { limit });
      if (!res.data?.length) return 'No companies found.';
      return res.data.map(formatCompany).join('\n');
    }
  },
  {
    name: 'attio_search_companies',
    description: 'Search for companies in Attio by name or domain.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Company name or domain to search for' }
      },
      required: ['query']
    },
    handler: async ({ query }) => {
      const res = await attio('POST', '/objects/companies/records/query', {
        filter: {
          or: [
            { attribute: 'name', condition: 'contains', value: query },
            { attribute: 'domains', condition: 'contains', value: query }
          ]
        }
      });
      if (!res.data?.length) return `No companies matching "${query}".`;
      return res.data.map(formatCompany).join('\n');
    }
  },
  {
    name: 'attio_create_company',
    description: 'Create a new company in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name' },
        domain: { type: 'string', description: 'Website domain (optional)' }
      },
      required: ['name']
    },
    handler: async ({ name, domain }) => {
      const values = { name: [{ value: name }] };
      if (domain) values.domains = [{ domain }];

      const res = await attio('POST', '/objects/companies/records', { data: { values } });
      return `✅ Created ${name}  [id: ${res.data.id.record_id}]`;
    }
  },
  {
    name: 'attio_list_deals',
    description: 'List deals in Attio CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await attio('POST', '/objects/deals/records/query', { limit });
      if (!res.data?.length) return 'No deals found.';
      return res.data.map(formatDeal).join('\n');
    }
  },
  {
    name: 'attio_add_note',
    description: 'Add a note to a person or company in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Object type: "people" or "companies"' },
        recordId: { type: 'string', description: 'The record ID' },
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content' }
      },
      required: ['objectType', 'recordId', 'title', 'content']
    },
    handler: async ({ objectType, recordId, title, content }) => {
      const res = await attio('POST', '/notes', {
        data: {
          title,
          content: [{ type: 'paragraph', children: [{ text: content }] }],
          parent_object: objectType === 'people' ? 'people' : 'companies',
          parent_record_id: recordId
        }
      });
      return `✅ Note added: "${title}"`;
    }
  }
];
