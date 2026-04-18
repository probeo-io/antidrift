import { createClient } from './client.mjs';

export default {
  description: 'Create or update an environment variable for a project.',
  input: {
    project: { type: 'string', description: 'Project name or ID' },
    key: { type: 'string', description: 'Variable name' },
    value: { type: 'string', description: 'Variable value' },
    target: { type: 'string', description: 'Targets: production, preview, development (comma-separated, default: all)', optional: true },
    type: { type: 'string', description: 'Type: plain, encrypted, secret, sensitive (default: encrypted)', optional: true }
  },
  execute: async ({ project, key, value, target, type = 'encrypted' }, ctx) => {
    const { vc } = createClient(ctx.credentials, ctx.fetch);
    const targets = target ? target.split(',').map(t => t.trim()) : ['production', 'preview', 'development'];
    await vc('POST', `/v10/projects/${encodeURIComponent(project)}/env`, {
      key, value, type, target: targets
    });
    return `Set ${key} for ${targets.join(', ')}`;
  }
};
