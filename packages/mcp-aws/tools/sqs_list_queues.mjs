import { createClient } from './client.mjs';

export default {
  description: 'List all SQS queues',
  input: {},
  execute: async (_args, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli('sqs list-queues');
    const urls = data.QueueUrls || [];
    if (!urls.length) return 'No SQS queues found.';
    return urls.map(url => {
      const name = url.split('/').pop();
      return `\u{1f4ec} ${name}\n   ${url}`;
    }).join('\n');
  }
};
