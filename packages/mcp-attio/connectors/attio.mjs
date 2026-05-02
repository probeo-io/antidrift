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
  const stageDate = vals.stage?.[0]?.created_at || '';
  const value = vals.value?.[0]?.currency_value || '';
  const createdAt = record.created_at || '';
  let line = `💰 ${name}`;
  if (stage) {
    line += `  •  ${stage}`;
    if (stageDate) {
      line += ` (since ${stageDate.slice(0, 10)}`;
      if (createdAt) {
        const days = Math.round((new Date(stageDate) - new Date(createdAt)) / 86400000);
        line += `, ${days}d from lead`;
      }
      line += `)`;
    }
  }
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
          '$or': [
            { name: { '$contains': query } },
            { email_addresses: { email_address: { '$contains': query } } }
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
          '$or': [
            { name: { '$contains': query } },
            { domains: { domain: { '$contains': query } } }
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
    name: 'attio_search_deals',
    description: 'Search for deals in Attio by name or stage.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Deal name or stage to search for' }
      },
      required: ['query']
    },
    handler: async ({ query }) => {
      const res = await attio('POST', '/objects/deals/records/query', {
        filter: {
          '$or': [
            { name: { '$contains': query } },
            { stage: { status: { '$contains': query } } }
          ]
        }
      });
      if (!res.data?.length) return `No deals matching "${query}".`;
      return res.data.map(formatDeal).join('\n');
    }
  },
  {
    name: 'attio_get_deal',
    description: 'Get full details for a deal including complete stage history and time spent in each stage.',
    inputSchema: {
      type: 'object',
      properties: {
        recordId: { type: 'string', description: 'The deal record ID' }
      },
      required: ['recordId']
    },
    handler: async ({ recordId }) => {
      const res = await attio('GET', `/objects/deals/records/${recordId}`);
      const vals = res.data.values || {};
      const lines = [];

      const name = vals.name?.[0]?.value || 'Unknown';
      const value = vals.value?.[0]?.currency_value;
      lines.push(`💰 ${name}${value != null ? `  •  $${value}` : ''}  [id: ${recordId}]`);

      const stages = (vals.stage || []).slice().sort((a, b) => new Date(a.active_from || a.created_at) - new Date(b.active_from || b.created_at));
      if (stages.length) {
        lines.push('');
        lines.push('Stage history:');
        for (const s of stages) {
          const title = s.status?.title || 'Unknown';
          const from = (s.active_from || s.created_at || '').slice(0, 10);
          const until = s.active_until ? s.active_until.slice(0, 10) : null;
          const days = (s.active_from || s.created_at) ? Math.round((until ? new Date(s.active_until) : new Date()) - new Date(s.active_from || s.created_at)) / 86400000 : null;
          const range = until ? `${from} → ${until}` : `${from} → now`;
          lines.push(`  ${title.padEnd(20)} ${range}${days != null ? `  (${Math.round(days)}d)` : ''}`);
        }
        const first = stages[0];
        const last = stages[stages.length - 1];
        if (first && (first.active_from || first.created_at)) {
          const total = Math.round(((last.active_until ? new Date(last.active_until) : new Date()) - new Date(first.active_from || first.created_at)) / 86400000);
          lines.push('');
          lines.push(`Total: ${total}d`);
        }
      }

      return lines.join('\n');
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
    name: 'attio_update_record',
    description: 'Update fields on a person, company, or deal in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Object type: "people", "companies", or "deals"' },
        recordId: { type: 'string', description: 'The record ID to update' },
        values: { type: 'object', description: 'Field values to update, e.g. {"job_title": [{"value": "CTO"}]}' }
      },
      required: ['objectType', 'recordId', 'values']
    },
    handler: async ({ objectType, recordId, values }) => {
      const res = await attio('PATCH', `/objects/${objectType}/records/${recordId}`, { data: { values } });
      return `✅ Updated ${objectType} record ${recordId}`;
    }
  },
  {
    name: 'attio_create_deal',
    description: 'Create a new deal in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Deal name' },
        stage: { type: 'string', description: 'Pipeline stage (e.g. "Qualified", "Proposal", "Closed Won")' },
        owner: { type: 'string', description: 'Workspace member email to assign as owner (optional)' },
        value: { type: 'number', description: 'Deal value in currency units (optional)' },
        linkedCompanyId: { type: 'string', description: 'Company record ID to associate with the deal (optional)' }
      },
      required: ['name']
    },
    handler: async ({ name, stage, owner, value, linkedCompanyId }) => {
      const values = { name: [{ value: name }] };
      if (stage) values.stage = [{ status: stage }];
      if (owner) values.owner = [{ workspace_member_email_address: owner }];
      if (value != null) values.value = [{ currency_value: value }];
      if (linkedCompanyId) values.associated_company = [{ target_object: 'companies', target_record_id: linkedCompanyId }];

      const res = await attio('POST', '/objects/deals/records', { data: { values } });
      return `✅ Created deal "${name}"  [id: ${res.data.id.record_id}]`;
    }
  },
  {
    name: 'attio_delete_deal',
    description: 'Delete a deal from Attio by record ID.',
    inputSchema: {
      type: 'object',
      properties: {
        recordId: { type: 'string', description: 'The deal record ID to delete' }
      },
      required: ['recordId']
    },
    handler: async ({ recordId }) => {
      await attio('DELETE', `/objects/deals/records/${recordId}`);
      return `✅ Deal ${recordId} deleted`;
    }
  },
  {
    name: 'attio_move_deal',
    description: 'Move a deal to a different pipeline stage in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        recordId: { type: 'string', description: 'The deal record ID' },
        stage: { type: 'string', description: 'The stage name to move to (e.g. "Qualified", "Proposal", "Closed Won")' }
      },
      required: ['recordId', 'stage']
    },
    handler: async ({ recordId, stage }) => {
      const res = await attio('PATCH', `/objects/deals/records/${recordId}`, {
        data: { values: { stage: [{ status: stage }] } }
      });
      return `✅ Deal moved to "${stage}"`;
    }
  },
  {
    name: 'attio_create_task',
    description: 'Create a task in Attio, optionally linked to a record.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Task description' },
        deadlineAt: { type: 'string', description: 'Deadline as ISO date string (optional)' },
        assignees: { type: 'string', description: 'Comma-separated workspace member IDs to assign (optional)' },
        linkedRecordId: { type: 'string', description: 'Record ID to link the task to (optional)' },
        linkedObjectType: { type: 'string', description: 'Object type of linked record: "people", "companies", or "deals" (optional)' }
      },
      required: ['content']
    },
    handler: async ({ content, deadlineAt, assignees, linkedRecordId, linkedObjectType }) => {
      const res = await attio('POST', '/tasks', {
        data: {
          content,
          format: 'plaintext',
          is_completed: false,
          deadline_at: deadlineAt || null,
          linked_records: (linkedRecordId && linkedObjectType) ? [{ target_object: linkedObjectType, target_record_id: linkedRecordId }] : [],
          assignees: assignees ? assignees.split(',').map(id => ({ referenced_actor_type: 'workspace-member', referenced_actor_id: id.trim() })) : []
        }
      });
      return `✅ Task created: "${content}"${deadlineAt ? ` (due: ${deadlineAt})` : ''}`;
    }
  },
  {
    name: 'attio_list_tasks',
    description: 'List tasks in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await attio('GET', `/tasks?limit=${limit}`);
      if (!res.data?.length) return 'No tasks found.';
      return res.data.map(t => {
        const status = t.is_completed ? '✅' : '⬜';
        const content = t.content_plaintext || 'No description';
        const deadline = t.deadline_at ? ` (due: ${new Date(t.deadline_at).toLocaleDateString()})` : '';
        return `${status} ${content}${deadline}  [id: ${t.id.task_id}]`;
      }).join('\n');
    }
  },
  {
    name: 'attio_complete_task',
    description: 'Mark a task as completed in Attio.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to complete' }
      },
      required: ['taskId']
    },
    handler: async ({ taskId }) => {
      await attio('PATCH', `/tasks/${taskId}`, { data: { is_completed: true } });
      return `✅ Task marked as completed`;
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
          content,
          format: 'plaintext',
          parent_object: objectType === 'people' ? 'people' : 'companies',
          parent_record_id: recordId
        }
      });
      return `✅ Note added: "${title}"`;
    }
  }
];
