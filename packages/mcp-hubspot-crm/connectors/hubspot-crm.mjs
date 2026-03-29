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

function formatContact(record) {
  const p = record.properties || {};
  const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown';
  const email = p.email || '';
  let line = `\ud83d\udc64 ${name}`;
  if (email) line += ` \u2014 ${email}`;
  line += ` [id: ${record.id}]`;
  return line;
}

function formatCompany(record) {
  const p = record.properties || {};
  const name = p.name || 'Unknown';
  const domain = p.domain || '';
  let line = `\ud83c\udfe2 ${name}`;
  if (domain) line += ` \u2014 ${domain}`;
  line += ` [id: ${record.id}]`;
  return line;
}

function formatDeal(record) {
  const p = record.properties || {};
  const name = p.dealname || 'Unknown';
  const stage = p.dealstage || '';
  const amount = p.amount || '';
  let line = `\ud83d\udcb0 ${name}`;
  if (stage) line += ` \u2014 ${stage}`;
  if (amount) line += ` $${amount}`;
  line += ` [id: ${record.id}]`;
  return line;
}

const CONTACT_PROPERTIES = ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'lifecyclestage'];
const COMPANY_PROPERTIES = ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue'];
const DEAL_PROPERTIES = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate'];

function searchPropertiesForType(objectType) {
  if (objectType === 'contacts') return ['firstname', 'lastname', 'email'];
  if (objectType === 'companies') return ['name', 'domain'];
  if (objectType === 'deals') return ['dealname', 'amount', 'dealstage'];
  return [];
}

export const tools = [
  {
    name: 'hubspot_list_contacts',
    description: 'List contacts in HubSpot CRM. Optionally search by query.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' },
        query: { type: 'string', description: 'Search query (optional)' }
      }
    },
    handler: async ({ limit = 20, query }) => {
      if (query) {
        const res = await hubspot('POST', '/crm/v3/objects/contacts/search', {
          query,
          limit,
          properties: CONTACT_PROPERTIES
        });
        if (!res.results?.length) return `No contacts matching "${query}".`;
        return res.results.map(formatContact).join('\n');
      }
      const res = await hubspot('GET', `/crm/v3/objects/contacts?limit=${limit}&properties=${CONTACT_PROPERTIES.join(',')}`);
      if (!res.results?.length) return 'No contacts found.';
      return res.results.map(formatContact).join('\n');
    }
  },
  {
    name: 'hubspot_get_contact',
    description: 'Get full details for a contact by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The contact ID' }
      },
      required: ['contactId']
    },
    handler: async ({ contactId }) => {
      const res = await hubspot('GET', `/crm/v3/objects/contacts/${contactId}?properties=${CONTACT_PROPERTIES.join(',')}`);
      const p = res.properties || {};
      const lines = [];
      const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown';
      lines.push(`\ud83d\udc64 ${name}`);
      if (p.email) lines.push(`\ud83d\udce7 ${p.email}`);
      if (p.phone) lines.push(`\ud83d\udcde ${p.phone}`);
      if (p.company) lines.push(`\ud83c\udfe2 ${p.company}`);
      if (p.jobtitle) lines.push(`\ud83d\udcbc ${p.jobtitle}`);
      if (p.lifecyclestage) lines.push(`\ud83d\udcca Lifecycle: ${p.lifecyclestage}`);
      lines.push(`[id: ${contactId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_create_contact',
    description: 'Create a new contact in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        phone: { type: 'string', description: 'Phone number (optional)' },
        company: { type: 'string', description: 'Company name (optional)' },
        jobTitle: { type: 'string', description: 'Job title (optional)' }
      },
      required: ['email']
    },
    handler: async ({ email, firstName, lastName, phone, company, jobTitle }) => {
      const properties = { email };
      if (firstName) properties.firstname = firstName;
      if (lastName) properties.lastname = lastName;
      if (phone) properties.phone = phone;
      if (company) properties.company = company;
      if (jobTitle) properties.jobtitle = jobTitle;

      const res = await hubspot('POST', '/crm/v3/objects/contacts', { properties });
      return `\u2705 Created ${firstName || ''} ${lastName || ''} (${email})  [id: ${res.id}]`;
    }
  },
  {
    name: 'hubspot_update_contact',
    description: 'Update a contact in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The contact ID' },
        properties: { type: 'object', description: 'Properties to update, e.g. {"firstname": "Jane", "phone": "555-1234"}' }
      },
      required: ['contactId', 'properties']
    },
    handler: async ({ contactId, properties }) => {
      await hubspot('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties });
      return `\u2705 Updated contact ${contactId}`;
    }
  },
  {
    name: 'hubspot_list_companies',
    description: 'List companies in HubSpot CRM. Optionally search by query.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' },
        query: { type: 'string', description: 'Search query (optional)' }
      }
    },
    handler: async ({ limit = 20, query }) => {
      if (query) {
        const res = await hubspot('POST', '/crm/v3/objects/companies/search', {
          query,
          limit,
          properties: COMPANY_PROPERTIES
        });
        if (!res.results?.length) return `No companies matching "${query}".`;
        return res.results.map(formatCompany).join('\n');
      }
      const res = await hubspot('GET', `/crm/v3/objects/companies?limit=${limit}&properties=${COMPANY_PROPERTIES.join(',')}`);
      if (!res.results?.length) return 'No companies found.';
      return res.results.map(formatCompany).join('\n');
    }
  },
  {
    name: 'hubspot_get_company',
    description: 'Get full details for a company by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'The company ID' }
      },
      required: ['companyId']
    },
    handler: async ({ companyId }) => {
      const res = await hubspot('GET', `/crm/v3/objects/companies/${companyId}?properties=${COMPANY_PROPERTIES.join(',')}`);
      const p = res.properties || {};
      const lines = [];
      lines.push(`\ud83c\udfe2 ${p.name || 'Unknown'}`);
      if (p.domain) lines.push(`\ud83c\udf10 ${p.domain}`);
      if (p.industry) lines.push(`\ud83c\udfed ${p.industry}`);
      if (p.numberofemployees) lines.push(`\ud83d\udc65 ${p.numberofemployees} employees`);
      if (p.annualrevenue) lines.push(`\ud83d\udcb5 $${p.annualrevenue} annual revenue`);
      lines.push(`[id: ${companyId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_create_company',
    description: 'Create a new company in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name' },
        domain: { type: 'string', description: 'Website domain (optional)' },
        industry: { type: 'string', description: 'Industry (optional)' }
      },
      required: ['name']
    },
    handler: async ({ name, domain, industry }) => {
      const properties = { name };
      if (domain) properties.domain = domain;
      if (industry) properties.industry = industry;

      const res = await hubspot('POST', '/crm/v3/objects/companies', { properties });
      return `\u2705 Created ${name}  [id: ${res.id}]`;
    }
  },
  {
    name: 'hubspot_update_company',
    description: 'Update a company in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'The company ID' },
        properties: { type: 'object', description: 'Properties to update, e.g. {"industry": "Technology"}' }
      },
      required: ['companyId', 'properties']
    },
    handler: async ({ companyId, properties }) => {
      await hubspot('PATCH', `/crm/v3/objects/companies/${companyId}`, { properties });
      return `\u2705 Updated company ${companyId}`;
    }
  },
  {
    name: 'hubspot_list_deals',
    description: 'List deals in HubSpot CRM. Optionally search by query.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' },
        query: { type: 'string', description: 'Search query (optional)' }
      }
    },
    handler: async ({ limit = 20, query }) => {
      if (query) {
        const res = await hubspot('POST', '/crm/v3/objects/deals/search', {
          query,
          limit,
          properties: DEAL_PROPERTIES
        });
        if (!res.results?.length) return `No deals matching "${query}".`;
        return res.results.map(formatDeal).join('\n');
      }
      const res = await hubspot('GET', `/crm/v3/objects/deals?limit=${limit}&properties=${DEAL_PROPERTIES.join(',')}`);
      if (!res.results?.length) return 'No deals found.';
      return res.results.map(formatDeal).join('\n');
    }
  },
  {
    name: 'hubspot_get_deal',
    description: 'Get full details for a deal by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'The deal ID' }
      },
      required: ['dealId']
    },
    handler: async ({ dealId }) => {
      const res = await hubspot('GET', `/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPERTIES.join(',')}`);
      const p = res.properties || {};
      const lines = [];
      lines.push(`\ud83d\udcb0 ${p.dealname || 'Unknown'}`);
      if (p.dealstage) lines.push(`\ud83d\udcca Stage: ${p.dealstage}`);
      if (p.pipeline) lines.push(`\ud83d\udee4\ufe0f Pipeline: ${p.pipeline}`);
      if (p.amount) lines.push(`\ud83d\udcb5 $${p.amount}`);
      if (p.closedate) lines.push(`\ud83d\udcc5 Close: ${p.closedate}`);
      lines.push(`[id: ${dealId}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_create_deal',
    description: 'Create a new deal in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Deal name' },
        amount: { type: 'string', description: 'Deal amount (optional)' },
        stage: { type: 'string', description: 'Deal stage (optional)' },
        pipeline: { type: 'string', description: 'Pipeline (optional, defaults to "default")' },
        closeDate: { type: 'string', description: 'Close date as ISO string (optional)' }
      },
      required: ['name']
    },
    handler: async ({ name, amount, stage, pipeline, closeDate }) => {
      const properties = { dealname: name };
      if (amount) properties.amount = amount;
      if (stage) properties.dealstage = stage;
      if (pipeline) properties.pipeline = pipeline;
      if (closeDate) properties.closedate = closeDate;

      const res = await hubspot('POST', '/crm/v3/objects/deals', { properties });
      return `\u2705 Created deal "${name}"  [id: ${res.id}]`;
    }
  },
  {
    name: 'hubspot_update_deal',
    description: 'Update a deal in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'The deal ID' },
        properties: { type: 'object', description: 'Properties to update, e.g. {"amount": "50000", "dealstage": "closedwon"}' }
      },
      required: ['dealId', 'properties']
    },
    handler: async ({ dealId, properties }) => {
      await hubspot('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties });
      return `\u2705 Updated deal ${dealId}`;
    }
  },
  {
    name: 'hubspot_add_note',
    description: 'Add a note to a contact, company, or deal in HubSpot.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Object type: "contacts", "companies", or "deals"' },
        objectId: { type: 'string', description: 'The record ID to attach the note to' },
        body: { type: 'string', description: 'Note content' }
      },
      required: ['objectType', 'objectId', 'body']
    },
    handler: async ({ objectType, objectId, body }) => {
      // Create the note (engagement)
      const noteRes = await hubspot('POST', '/crm/v3/objects/notes', {
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString()
        }
      });
      const noteId = noteRes.id;

      // Associate the note with the record
      await hubspot('PUT', `/crm/v4/objects/notes/${noteId}/associations/${objectType}/${objectId}`, [
        { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: objectType === 'contacts' ? 202 : objectType === 'companies' ? 190 : 214 }
      ]);

      return `\u2705 Note added to ${objectType} ${objectId}  [note id: ${noteId}]`;
    }
  },
  {
    name: 'hubspot_list_activities',
    description: 'List recent notes/activities for a contact, company, or deal.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Object type: "contacts", "companies", or "deals"' },
        objectId: { type: 'string', description: 'The record ID' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['objectType', 'objectId']
    },
    handler: async ({ objectType, objectId, limit = 10 }) => {
      // Get associated notes
      const assocRes = await hubspot('GET', `/crm/v4/objects/${objectType}/${objectId}/associations/notes`);
      const noteIds = (assocRes.results || []).slice(0, limit).map(r => r.toObjectId);

      if (!noteIds.length) return `No notes found for ${objectType} ${objectId}.`;

      // Fetch each note
      const lines = [];
      for (const noteId of noteIds) {
        try {
          const note = await hubspot('GET', `/crm/v3/objects/notes/${noteId}?properties=hs_note_body,hs_timestamp`);
          const p = note.properties || {};
          const date = p.hs_timestamp ? new Date(p.hs_timestamp).toLocaleDateString() : '';
          const body = (p.hs_note_body || '').replace(/<[^>]+>/g, '').substring(0, 200);
          lines.push(`\ud83d\udcdd ${date ? `[${date}] ` : ''}${body}  [note id: ${noteId}]`);
        } catch {
          lines.push(`\ud83d\udcdd [note id: ${noteId}] (could not load)`);
        }
      }
      return lines.join('\n');
    }
  },
  {
    name: 'hubspot_search',
    description: 'Search across contacts, companies, or deals in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Object type: "contacts", "companies", or "deals"' },
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['objectType', 'query']
    },
    handler: async ({ objectType, query, limit = 10 }) => {
      const properties = searchPropertiesForType(objectType);
      const res = await hubspot('POST', `/crm/v3/objects/${objectType}/search`, {
        query,
        limit,
        properties
      });

      if (!res.results?.length) return `No ${objectType} matching "${query}".`;

      const formatter = objectType === 'contacts' ? formatContact
        : objectType === 'companies' ? formatCompany
        : formatDeal;

      return res.results.map(formatter).join('\n');
    }
  }
];
