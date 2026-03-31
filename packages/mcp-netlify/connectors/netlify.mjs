import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'netlify.json'), 'utf8'));

async function nf(method, path, body) {
  const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Netlify API ${res.status}: ${err}`);
  }
  return res.json();
}

export const tools = [
  {
    name: 'netlify_list_sites',
    description: 'List all sites in your Netlify account.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await nf('GET', `/sites?per_page=${limit}`);
      if (!res.length) return 'No sites found.';
      return res.map(s => {
        let line = `${s.name}`;
        if (s.ssl_url) line += `  ${s.ssl_url}`;
        if (s.published_deploy?.branch) line += `  [${s.published_deploy.branch}]`;
        line += `  [id: ${s.id}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'netlify_get_site',
    description: 'Get details for a Netlify site by name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', description: 'Site ID or name (e.g. my-site.netlify.app)' }
      },
      required: ['siteId']
    },
    handler: async ({ siteId }) => {
      const res = await nf('GET', `/sites/${encodeURIComponent(siteId)}`);
      const lines = [];
      lines.push(`${res.name}  ${res.ssl_url || res.url}`);
      if (res.repo?.repo_path) lines.push(`Repo: ${res.repo.repo_path}`);
      if (res.repo?.branch) lines.push(`Branch: ${res.repo.branch}`);
      if (res.build_settings?.cmd) lines.push(`Build: ${res.build_settings.cmd}`);
      if (res.build_settings?.dir) lines.push(`Publish: ${res.build_settings.dir}`);
      lines.push(`Created: ${new Date(res.created_at).toLocaleDateString()}`);
      lines.push(`Updated: ${new Date(res.updated_at).toLocaleDateString()}`);
      lines.push(`[id: ${res.id}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'netlify_list_deploys',
    description: 'List recent deploys for a site.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', description: 'Site ID' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['siteId']
    },
    handler: async ({ siteId, limit = 10 }) => {
      const res = await nf('GET', `/sites/${encodeURIComponent(siteId)}/deploys?per_page=${limit}`);
      if (!res.length) return 'No deploys found.';
      return res.map(d => {
        let line = `${d.id.slice(0, 8)}  [${d.state}]`;
        if (d.branch) line += `  ${d.branch}`;
        if (d.title) line += `  "${d.title.slice(0, 60)}"`;
        if (d.deploy_time) line += `  ${d.deploy_time}s`;
        line += `  ${new Date(d.created_at).toLocaleString()}`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'netlify_get_deploy',
    description: 'Get details for a specific deploy.',
    inputSchema: {
      type: 'object',
      properties: {
        deployId: { type: 'string', description: 'Deploy ID' }
      },
      required: ['deployId']
    },
    handler: async ({ deployId }) => {
      const res = await nf('GET', `/deploys/${deployId}`);
      const lines = [];
      lines.push(`${res.id}  [${res.state}]`);
      if (res.ssl_url) lines.push(`URL: ${res.ssl_url}`);
      if (res.branch) lines.push(`Branch: ${res.branch}`);
      if (res.title) lines.push(`Title: ${res.title}`);
      if (res.commit_ref) lines.push(`Commit: ${res.commit_ref.slice(0, 8)}`);
      if (res.deploy_time) lines.push(`Build time: ${res.deploy_time}s`);
      if (res.error_message) lines.push(`Error: ${res.error_message}`);
      lines.push(`Created: ${new Date(res.created_at).toLocaleString()}`);
      return lines.join('\n');
    }
  },
  {
    name: 'netlify_rollback',
    description: 'Rollback to a previous deploy.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', description: 'Site ID' },
        deployId: { type: 'string', description: 'Deploy ID to restore' }
      },
      required: ['siteId', 'deployId']
    },
    handler: async ({ siteId, deployId }) => {
      const res = await nf('POST', `/sites/${encodeURIComponent(siteId)}/deploys/${deployId}/restore`);
      return `Rolled back to deploy ${deployId}  [${res.state}]`;
    }
  },
  {
    name: 'netlify_list_env_vars',
    description: 'List environment variables for a site.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account/team slug (from your Netlify URL)' },
        siteId: { type: 'string', description: 'Site ID to filter by (optional)' }
      },
      required: ['accountId']
    },
    handler: async ({ accountId, siteId }) => {
      let path = `/accounts/${encodeURIComponent(accountId)}/env`;
      if (siteId) path += `?site_id=${encodeURIComponent(siteId)}`;
      const res = await nf('GET', path);
      if (!res.length) return 'No environment variables found.';
      return res.map(e => {
        const contexts = e.values?.map(v => v.context).join(', ') || 'all';
        return `${e.key}  [${contexts}]`;
      }).join('\n');
    }
  },
  {
    name: 'netlify_set_env_var',
    description: 'Create or update an environment variable.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account/team slug' },
        key: { type: 'string', description: 'Variable name' },
        value: { type: 'string', description: 'Variable value' },
        context: { type: 'string', description: 'Context: all, production, deploy-preview, branch-deploy, dev (default: all)' }
      },
      required: ['accountId', 'key', 'value']
    },
    handler: async ({ accountId, key, value, context = 'all' }) => {
      const res = await nf('POST', `/accounts/${encodeURIComponent(accountId)}/env`, [{
        key,
        scopes: ['builds', 'functions', 'runtime', 'post_processing'],
        values: [{ value, context }]
      }]);
      return `Set ${key} for context: ${context}`;
    }
  },
  {
    name: 'netlify_list_forms',
    description: 'List forms for a site.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', description: 'Site ID' }
      },
      required: ['siteId']
    },
    handler: async ({ siteId }) => {
      const res = await nf('GET', `/sites/${encodeURIComponent(siteId)}/forms`);
      if (!res.length) return 'No forms found.';
      return res.map(f => `${f.name}  (${f.submission_count} submissions)  [id: ${f.id}]`).join('\n');
    }
  },
  {
    name: 'netlify_list_submissions',
    description: 'List form submissions.',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['formId']
    },
    handler: async ({ formId, limit = 20 }) => {
      const res = await nf('GET', `/forms/${formId}/submissions?per_page=${limit}`);
      if (!res.length) return 'No submissions found.';
      return res.map(s => {
        const data = s.data || {};
        const fields = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ');
        return `${new Date(s.created_at).toLocaleString()}  ${fields}`;
      }).join('\n');
    }
  },
  {
    name: 'netlify_trigger_build',
    description: 'Trigger a new build for a site.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', description: 'Site ID' }
      },
      required: ['siteId']
    },
    handler: async ({ siteId }) => {
      const res = await nf('POST', `/sites/${encodeURIComponent(siteId)}/builds`);
      return `Build triggered  [id: ${res.id}]  [${res.done ? 'done' : 'building'}]`;
    }
  }
];
