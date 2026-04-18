import { createClient } from './client.mjs';

export default {
  description: 'List all sales pipelines and their stages.',
  input: {},
  execute: async (_args, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
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
};
