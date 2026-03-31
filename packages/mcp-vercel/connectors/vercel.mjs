import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'vercel.json'), 'utf8'));

async function vc(method, path, body) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel API ${res.status}: ${err}`);
  }
  return res.json();
}

export const tools = [
  {
    name: 'vercel_list_projects',
    description: 'List all projects in your Vercel account.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await vc('GET', `/v9/projects?limit=${limit}`);
      if (!res.projects?.length) return 'No projects found.';
      return res.projects.map(p => {
        let line = `${p.name}`;
        if (p.framework) line += `  [${p.framework}]`;
        line += `  [id: ${p.id}]`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'vercel_get_project',
    description: 'Get details for a Vercel project by name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' }
      },
      required: ['project']
    },
    handler: async ({ project }) => {
      const res = await vc('GET', `/v9/projects/${encodeURIComponent(project)}`);
      const lines = [];
      lines.push(`${res.name}  [${res.framework || 'unknown framework'}]`);
      if (res.link?.type) lines.push(`Repo: ${res.link.type} — ${res.link.org}/${res.link.repo}`);
      lines.push(`Created: ${new Date(res.createdAt).toLocaleDateString()}`);
      lines.push(`Updated: ${new Date(res.updatedAt).toLocaleDateString()}`);
      if (res.targets?.production?.url) lines.push(`Production: https://${res.targets.production.url}`);
      lines.push(`[id: ${res.id}]`);
      return lines.join('\n');
    }
  },
  {
    name: 'vercel_list_deployments',
    description: 'List recent deployments for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' },
        limit: { type: 'number', description: 'Max results (default 10)' },
        state: { type: 'string', description: 'Filter by state: BUILDING, ERROR, INITIALIZING, QUEUED, READY, CANCELED' }
      },
      required: ['project']
    },
    handler: async ({ project, limit = 10, state }) => {
      let path = `/v6/deployments?projectId=${encodeURIComponent(project)}&limit=${limit}`;
      if (state) path += `&state=${state}`;
      const res = await vc('GET', path);
      if (!res.deployments?.length) return 'No deployments found.';
      return res.deployments.map(d => {
        let line = `${d.url || d.uid}  [${d.state || d.readyState}]`;
        if (d.meta?.githubCommitMessage) line += `  "${d.meta.githubCommitMessage.slice(0, 60)}"`;
        line += `  ${new Date(d.created).toLocaleString()}`;
        return line;
      }).join('\n');
    }
  },
  {
    name: 'vercel_get_deployment',
    description: 'Get details for a specific deployment.',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Deployment ID or URL' }
      },
      required: ['deploymentId']
    },
    handler: async ({ deploymentId }) => {
      const res = await vc('GET', `/v13/deployments/${encodeURIComponent(deploymentId)}`);
      const lines = [];
      lines.push(`${res.url}  [${res.readyState}]`);
      lines.push(`Project: ${res.name}`);
      if (res.meta?.githubCommitMessage) lines.push(`Commit: ${res.meta.githubCommitMessage}`);
      if (res.meta?.githubCommitRef) lines.push(`Branch: ${res.meta.githubCommitRef}`);
      lines.push(`Created: ${new Date(res.createdAt).toLocaleString()}`);
      if (res.ready) lines.push(`Ready: ${new Date(res.ready).toLocaleString()}`);
      if (res.target) lines.push(`Target: ${res.target}`);
      return lines.join('\n');
    }
  },
  {
    name: 'vercel_list_domains',
    description: 'List domains for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' }
      },
      required: ['project']
    },
    handler: async ({ project }) => {
      const res = await vc('GET', `/v9/projects/${encodeURIComponent(project)}/domains`);
      if (!res.domains?.length) return 'No domains found.';
      return res.domains.map(d => {
        let line = `${d.name}`;
        if (d.redirect) line += `  → ${d.redirect}`;
        if (d.verified !== undefined) line += d.verified ? '  [verified]' : '  [unverified]';
        return line;
      }).join('\n');
    }
  },
  {
    name: 'vercel_list_env_vars',
    description: 'List environment variables for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' }
      },
      required: ['project']
    },
    handler: async ({ project }) => {
      const res = await vc('GET', `/v9/projects/${encodeURIComponent(project)}/env`);
      if (!res.envs?.length) return 'No environment variables found.';
      return res.envs.map(e => {
        const targets = e.target?.join(', ') || 'all';
        return `${e.key}  [${e.type}]  targets: ${targets}`;
      }).join('\n');
    }
  },
  {
    name: 'vercel_create_env_var',
    description: 'Create or update an environment variable for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' },
        key: { type: 'string', description: 'Variable name' },
        value: { type: 'string', description: 'Variable value' },
        target: { type: 'string', description: 'Targets: production, preview, development (comma-separated, default: all)' },
        type: { type: 'string', description: 'Type: plain, encrypted, secret, sensitive (default: encrypted)' }
      },
      required: ['project', 'key', 'value']
    },
    handler: async ({ project, key, value, target, type = 'encrypted' }) => {
      const targets = target ? target.split(',').map(t => t.trim()) : ['production', 'preview', 'development'];
      const res = await vc('POST', `/v10/projects/${encodeURIComponent(project)}/env`, {
        key, value, type, target: targets
      });
      return `Set ${key} for ${targets.join(', ')}`;
    }
  },
  {
    name: 'vercel_redeploy',
    description: 'Trigger a redeployment of the latest production deployment.',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Deployment ID to redeploy' }
      },
      required: ['deploymentId']
    },
    handler: async ({ deploymentId }) => {
      const res = await vc('POST', `/v13/deployments?forceNew=1`, {
        deploymentId,
        target: 'production'
      });
      return `Redeployment triggered: ${res.url}  [${res.readyState}]`;
    }
  },
  {
    name: 'vercel_get_deployment_events',
    description: 'Get build logs/events for a deployment.',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Deployment ID' }
      },
      required: ['deploymentId']
    },
    handler: async ({ deploymentId }) => {
      const res = await vc('GET', `/v3/deployments/${encodeURIComponent(deploymentId)}/events`);
      if (!res.length) return 'No events found.';
      return res.slice(-30).map(e => {
        const time = e.created ? new Date(e.created).toLocaleTimeString() : '';
        return `${time}  ${e.text || e.payload?.text || JSON.stringify(e)}`;
      }).join('\n');
    }
  }
];
