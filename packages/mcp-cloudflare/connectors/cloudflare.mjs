import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'cloudflare.json'), 'utf8'));

async function cf(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudflare API ${res.status}: ${err}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || 'Unknown error');
  return json;
}

export const tools = [
  // --- DNS ---
  {
    name: 'cf_list_zones',
    description: 'List DNS zones (domains) in your Cloudflare account.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await cf('GET', `/zones?per_page=${limit}`);
      if (!res.result?.length) return 'No zones found.';
      return res.result.map(z => `${z.name}  [${z.status}]  [id: ${z.id}]`).join('\n');
    }
  },
  {
    name: 'cf_list_dns_records',
    description: 'List DNS records for a zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zoneId: { type: 'string', description: 'Zone ID' },
        type: { type: 'string', description: 'Filter by record type (A, AAAA, CNAME, MX, TXT, etc.)' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      },
      required: ['zoneId']
    },
    handler: async ({ zoneId, type, limit = 50 }) => {
      let path = `/zones/${zoneId}/dns_records?per_page=${limit}`;
      if (type) path += `&type=${type}`;
      const res = await cf('GET', path);
      if (!res.result?.length) return 'No DNS records found.';
      return res.result.map(r => {
        let line = `${r.type.padEnd(6)} ${r.name}  →  ${r.content}`;
        if (r.proxied) line += '  [proxied]';
        if (r.ttl !== 1) line += `  TTL: ${r.ttl}`;
        line += `  [id: ${r.id}]`;
        return line;
      }).join('\n');
    }
  },
  // --- Pages ---
  {
    name: 'cf_list_pages_projects',
    description: 'List Cloudflare Pages projects.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' }
      },
      required: ['accountId']
    },
    handler: async ({ accountId }) => {
      const res = await cf('GET', `/accounts/${accountId}/pages/projects`);
      if (!res.result?.length) return 'No Pages projects found.';
      return res.result.map(p => {
        let line = `${p.name}`;
        if (p.subdomain) line += `  ${p.subdomain}`;
        if (p.source?.type) line += `  [${p.source.type}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'cf_get_pages_project',
    description: 'Get details for a Pages project.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        projectName: { type: 'string', description: 'Project name' }
      },
      required: ['accountId', 'projectName']
    },
    handler: async ({ accountId, projectName }) => {
      const res = await cf('GET', `/accounts/${accountId}/pages/projects/${projectName}`);
      const p = res.result;
      const lines = [];
      lines.push(`${p.name}  ${p.subdomain || ''}`);
      if (p.source?.type) lines.push(`Source: ${p.source.type} — ${p.source.config?.owner}/${p.source.config?.repo_name}`);
      if (p.build_config?.build_command) lines.push(`Build: ${p.build_config.build_command}`);
      if (p.build_config?.destination_dir) lines.push(`Output: ${p.build_config.destination_dir}`);
      if (p.latest_deployment?.url) lines.push(`Latest: ${p.latest_deployment.url}  [${p.latest_deployment.latest_stage?.name}]`);
      if (p.domains?.length) lines.push(`Domains: ${p.domains.join(', ')}`);
      return lines.join('\n');
    }
  },
  {
    name: 'cf_list_pages_deployments',
    description: 'List deployments for a Pages project.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        projectName: { type: 'string', description: 'Project name' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['accountId', 'projectName']
    },
    handler: async ({ accountId, projectName, limit = 10 }) => {
      const res = await cf('GET', `/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=${limit}`);
      if (!res.result?.length) return 'No deployments found.';
      return res.result.map(d => {
        let line = `${d.id.slice(0, 8)}  [${d.latest_stage?.name || d.environment}]`;
        if (d.deployment_trigger?.metadata?.commit_message) line += `  "${d.deployment_trigger.metadata.commit_message.slice(0, 50)}"`;
        line += `  ${new Date(d.created_on).toLocaleString()}`;
        return line;
      }).join('\n');
    }
  },
  // --- Workers ---
  {
    name: 'cf_list_workers',
    description: 'List Workers scripts.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' }
      },
      required: ['accountId']
    },
    handler: async ({ accountId }) => {
      const res = await cf('GET', `/accounts/${accountId}/workers/scripts`);
      if (!res.result?.length) return 'No Workers found.';
      return res.result.map(w => {
        let line = `${w.id}`;
        if (w.modified_on) line += `  modified: ${new Date(w.modified_on).toLocaleDateString()}`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'cf_get_worker',
    description: 'Get metadata for a Worker script.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' },
        scriptName: { type: 'string', description: 'Worker script name' }
      },
      required: ['accountId', 'scriptName']
    },
    handler: async ({ accountId, scriptName }) => {
      const res = await cf('GET', `/accounts/${accountId}/workers/scripts/${scriptName}/settings`);
      const s = res.result;
      const lines = [`${scriptName}`];
      if (s.bindings?.length) {
        lines.push(`Bindings: ${s.bindings.map(b => `${b.name} (${b.type})`).join(', ')}`);
      }
      if (s.compatibility_date) lines.push(`Compat date: ${s.compatibility_date}`);
      return lines.join('\n');
    }
  },
  // --- R2 ---
  {
    name: 'cf_list_r2_buckets',
    description: 'List R2 storage buckets.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' }
      },
      required: ['accountId']
    },
    handler: async ({ accountId }) => {
      const res = await cf('GET', `/accounts/${accountId}/r2/buckets`);
      if (!res.result?.buckets?.length) return 'No R2 buckets found.';
      return res.result.buckets.map(b => {
        let line = `${b.name}`;
        if (b.location) line += `  [${b.location}]`;
        line += `  created: ${new Date(b.creation_date).toLocaleDateString()}`;
        return line;
      }).join('\n');
    }
  },
];
