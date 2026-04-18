import { createClient } from './client.mjs';

export default {
  description: 'Create or update an environment variable.',
  input: {
    accountId: { type: 'string', description: 'Account/team slug' },
    key: { type: 'string', description: 'Variable name' },
    value: { type: 'string', description: 'Variable value' },
    context: { type: 'string', description: 'Context: all, production, deploy-preview, branch-deploy, dev (default: all)', optional: true }
  },
  execute: async ({ accountId, key, value, context = 'all' }, ctx) => {
    const { nf } = createClient(ctx.credentials, ctx.fetch);
    await nf('POST', `/accounts/${encodeURIComponent(accountId)}/env`, [{
      key,
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [{ value, context }]
    }]);
    return `Set ${key} for context: ${context}`;
  }
};
