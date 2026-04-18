import { createClient } from './client.mjs';

export default {
  description: 'Get database schema and properties from Notion.',
  input: {
    databaseId: { type: 'string', description: 'The database ID' }
  },
  execute: async ({ databaseId }, ctx) => {
    const { notion, fetchAllChildren, fetchBlocksRecursive } = createClient(ctx.credentials, ctx.fetch);
    const db = await notion('GET', `/databases/${databaseId}`);
    const title = db.title?.map(t => t.plain_text).join('') || 'Untitled';
    const lines = [`\uD83D\uDDC4\uFE0F ${title} [id: ${db.id}]`, ''];
    lines.push('Properties:');
    for (const [name, prop] of Object.entries(db.properties || {})) {
      let detail = prop.type;
      if (prop.type === 'select' && prop.select?.options?.length) {
        detail += `: ${prop.select.options.map(o => o.name).join(', ')}`;
      }
      if (prop.type === 'multi_select' && prop.multi_select?.options?.length) {
        detail += `: ${prop.multi_select.options.map(o => o.name).join(', ')}`;
      }
      if (prop.type === 'status' && prop.status?.options?.length) {
        detail += `: ${prop.status.options.map(o => o.name).join(', ')}`;
      }
      lines.push(`  ${name} (${detail})`);
    }
    return lines.join('\n');
  }
};
