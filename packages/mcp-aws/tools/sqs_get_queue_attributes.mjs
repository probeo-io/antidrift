import { createClient, sanitize } from './client.mjs';

export default {
  description: 'Get queue depth, messages in flight, and other attributes for an SQS queue',
  input: {
    queueUrl: { type: 'string', description: 'Full SQS queue URL' }
  },
  execute: async ({ queueUrl }, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const data = awsCli(`sqs get-queue-attributes --queue-url ${sanitize(queueUrl)} --attribute-names All`);
    const attrs = data.Attributes || {};
    return [
      `Queue: ${queueUrl.split('/').pop()}`,
      `Messages Available: ${attrs.ApproximateNumberOfMessages || 0}`,
      `Messages In Flight: ${attrs.ApproximateNumberOfMessagesNotVisible || 0}`,
      `Messages Delayed: ${attrs.ApproximateNumberOfMessagesDelayed || 0}`,
      `Retention: ${Math.round((parseInt(attrs.MessageRetentionPeriod) || 0) / 86400)} days`,
      `Visibility Timeout: ${attrs.VisibilityTimeout || 0}s`,
      `Created: ${new Date(parseInt(attrs.CreatedTimestamp || 0) * 1000).toISOString()}`,
    ].join('\n');
  }
};
