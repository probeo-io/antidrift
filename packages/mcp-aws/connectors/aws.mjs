import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_PATH = join(homedir(), '.antidrift', 'aws.json');

function getRegion() {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return config.region || 'us-east-1';
  } catch {
    return 'us-east-1';
  }
}

/**
 * Sanitize a string for safe shell usage.
 * Only allows alphanumeric, hyphens, underscores, dots, slashes, colons, equals, and at signs.
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Remove any characters that could be used for shell injection
  return str.replace(/[^a-zA-Z0-9\-_./=:@+ ]/g, '');
}

/**
 * Execute an AWS CLI command and return parsed JSON.
 */
function awsCli(command) {
  const region = getRegion();
  const result = execSync(`aws ${command} --region ${sanitize(region)} --output json`, {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(result);
}

/**
 * Execute an AWS CLI command and return raw stdout (for non-JSON output).
 */
function awsCliRaw(command) {
  const region = getRegion();
  return execSync(`aws ${command} --region ${sanitize(region)}`, {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const tools = [

  // 1. aws_whoami
  {
    name: 'aws_whoami',
    description: 'Show current AWS identity (account ID, user ARN, user ID)',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const identity = awsCli('sts get-caller-identity');
      return {
        account: identity.Account,
        arn: identity.Arn,
        userId: identity.UserId,
      };
    },
  },

  // 2. aws_s3_list_buckets
  {
    name: 'aws_s3_list_buckets',
    description: 'List all S3 buckets in the account',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const data = awsCli('s3api list-buckets');
      const buckets = (data.Buckets || []).map(b =>
        `\u{1FAA3} ${b.Name} (created ${b.CreationDate})`
      );
      return buckets.length ? buckets.join('\n') : 'No buckets found.';
    },
  },

  // 3. aws_s3_list_objects
  {
    name: 'aws_s3_list_objects',
    description: 'List objects in an S3 bucket with optional prefix filter',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'S3 bucket name' },
        prefix: { type: 'string', description: 'Key prefix to filter by (optional)' },
        limit: { type: 'number', description: 'Max number of objects to return (default 20)' },
      },
      required: ['bucket'],
    },
    handler: async ({ bucket, prefix, limit }) => {
      const maxKeys = Math.min(Math.max(parseInt(limit) || 20, 1), 1000);
      let cmd = `s3api list-objects-v2 --bucket ${sanitize(bucket)} --max-keys ${maxKeys}`;
      if (prefix) cmd += ` --prefix ${sanitize(prefix)}`;
      const data = awsCli(cmd);
      const objects = (data.Contents || []).map(o =>
        `${o.Key} (${o.Size} bytes, ${o.LastModified})`
      );
      return objects.length ? objects.join('\n') : 'No objects found.';
    },
  },

  // 4. aws_s3_get_object
  {
    name: 'aws_s3_get_object',
    description: 'Read a text file from S3 (returns content as string)',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'S3 bucket name' },
        key: { type: 'string', description: 'Object key (path)' },
      },
      required: ['bucket', 'key'],
    },
    handler: async ({ bucket, key }) => {
      const content = awsCliRaw(`s3 cp s3://${sanitize(bucket)}/${sanitize(key)} -`);
      return content;
    },
  },

  // 5. aws_lambda_list_functions
  {
    name: 'aws_lambda_list_functions',
    description: 'List all Lambda functions in the current region',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const data = awsCli('lambda list-functions');
      const fns = (data.Functions || []).map(f =>
        `\u26a1 ${f.FunctionName} \u2014 ${f.Runtime || 'n/a'}, ${f.MemorySize}MB, last modified ${f.LastModified}`
      );
      return fns.length ? fns.join('\n') : 'No Lambda functions found.';
    },
  },

  // 6. aws_lambda_get_function
  {
    name: 'aws_lambda_get_function',
    description: 'Get detailed configuration for a Lambda function',
    inputSchema: {
      type: 'object',
      properties: {
        functionName: { type: 'string', description: 'Lambda function name or ARN' },
      },
      required: ['functionName'],
    },
    handler: async ({ functionName }) => {
      return awsCli(`lambda get-function-configuration --function-name ${sanitize(functionName)}`);
    },
  },

  // 7. aws_lambda_invoke
  {
    name: 'aws_lambda_invoke',
    description: 'Invoke a Lambda function and return its response',
    inputSchema: {
      type: 'object',
      properties: {
        functionName: { type: 'string', description: 'Lambda function name or ARN' },
        payload: { type: 'string', description: 'JSON payload to send (optional)' },
      },
      required: ['functionName'],
    },
    handler: async ({ functionName, payload }) => {
      let cmd = `lambda invoke --function-name ${sanitize(functionName)}`;
      if (payload) {
        // Use JSON.stringify to safely escape the payload
        cmd += ` --payload ${JSON.stringify(payload)}`;
      }
      cmd += ' /dev/stdout';
      const result = awsCliRaw(cmd);
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    },
  },

  // 8. aws_ecs_list_clusters
  {
    name: 'aws_ecs_list_clusters',
    description: 'List all ECS clusters',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const data = awsCli('ecs list-clusters');
      const arns = data.clusterArns || [];
      if (!arns.length) return 'No ECS clusters found.';
      return arns.map(arn => {
        const name = arn.split('/').pop();
        return `\u{1f4e6} ${name}`;
      }).join('\n');
    },
  },

  // 9. aws_ecs_list_services
  {
    name: 'aws_ecs_list_services',
    description: 'List services in an ECS cluster',
    inputSchema: {
      type: 'object',
      properties: {
        cluster: { type: 'string', description: 'ECS cluster name or ARN' },
      },
      required: ['cluster'],
    },
    handler: async ({ cluster }) => {
      const data = awsCli(`ecs list-services --cluster ${sanitize(cluster)}`);
      const arns = data.serviceArns || [];
      if (!arns.length) return 'No services found in this cluster.';
      return arns.map(arn => arn.split('/').pop()).join('\n');
    },
  },

  // 10. aws_ecs_describe_service
  {
    name: 'aws_ecs_describe_service',
    description: 'Get details for an ECS service (running count, desired count, recent events)',
    inputSchema: {
      type: 'object',
      properties: {
        cluster: { type: 'string', description: 'ECS cluster name or ARN' },
        service: { type: 'string', description: 'Service name or ARN' },
      },
      required: ['cluster', 'service'],
    },
    handler: async ({ cluster, service }) => {
      const data = awsCli(`ecs describe-services --cluster ${sanitize(cluster)} --services ${sanitize(service)}`);
      const svc = (data.services || [])[0];
      if (!svc) return 'Service not found.';
      const events = (svc.events || []).slice(0, 5).map(e =>
        `  ${e.createdAt}: ${e.message}`
      );
      return [
        `Service: ${svc.serviceName}`,
        `Status: ${svc.status}`,
        `Running: ${svc.runningCount} / ${svc.desiredCount} desired`,
        `Task Definition: ${svc.taskDefinition}`,
        `Launch Type: ${svc.launchType || 'n/a'}`,
        '',
        'Recent Events:',
        ...events,
      ].join('\n');
    },
  },

  // 11. aws_logs_list_groups
  {
    name: 'aws_logs_list_groups',
    description: 'List CloudWatch log groups',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of log groups (default 50)' },
      },
      required: [],
    },
    handler: async ({ limit }) => {
      const maxGroups = Math.min(Math.max(parseInt(limit) || 50, 1), 50);
      const data = awsCli(`logs describe-log-groups --limit ${maxGroups}`);
      const groups = (data.logGroups || []).map(g => {
        const bytes = g.storedBytes != null ? `${(g.storedBytes / 1024 / 1024).toFixed(1)}MB` : 'n/a';
        return `\u{1f4cb} ${g.logGroupName} (${bytes} stored)`;
      });
      return groups.length ? groups.join('\n') : 'No log groups found.';
    },
  },

  // 12. aws_logs_tail
  {
    name: 'aws_logs_tail',
    description: 'Get recent log events from a CloudWatch log group',
    inputSchema: {
      type: 'object',
      properties: {
        logGroup: { type: 'string', description: 'Log group name (e.g. /aws/lambda/my-function)' },
        limit: { type: 'number', description: 'Max number of events (default 20)' },
      },
      required: ['logGroup'],
    },
    handler: async ({ logGroup, limit }) => {
      const maxEvents = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const data = awsCli(`logs filter-log-events --log-group-name ${sanitize(logGroup)} --limit ${maxEvents} --interleaved`);
      const events = (data.events || []).map(e => {
        const ts = new Date(e.timestamp).toISOString();
        const msg = (e.message || '').trim();
        return `[${ts}] ${msg}`;
      });
      return events.length ? events.join('\n') : 'No recent log events.';
    },
  },

  // 13. aws_sqs_list_queues
  {
    name: 'aws_sqs_list_queues',
    description: 'List all SQS queues',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const data = awsCli('sqs list-queues');
      const urls = data.QueueUrls || [];
      if (!urls.length) return 'No SQS queues found.';
      return urls.map(url => {
        const name = url.split('/').pop();
        return `\u{1f4ec} ${name}\n   ${url}`;
      }).join('\n');
    },
  },

  // 14. aws_sqs_get_queue_attributes
  {
    name: 'aws_sqs_get_queue_attributes',
    description: 'Get queue depth, messages in flight, and other attributes for an SQS queue',
    inputSchema: {
      type: 'object',
      properties: {
        queueUrl: { type: 'string', description: 'Full SQS queue URL' },
      },
      required: ['queueUrl'],
    },
    handler: async ({ queueUrl }) => {
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
    },
  },

  // 15. aws_cost_today
  {
    name: 'aws_cost_today',
    description: "Get today's estimated AWS cost (requires Cost Explorer access)",
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fmt = d => d.toISOString().slice(0, 10);

      const data = awsCli(`ce get-cost-and-usage --time-period Start=${fmt(today)},End=${fmt(tomorrow)} --granularity DAILY --metrics UnblendedCost`);
      const results = data.ResultsByTime || [];
      if (!results.length) return 'No cost data available for today.';

      const cost = results[0].Total?.UnblendedCost;
      if (!cost) return 'No cost data available for today.';

      const amount = parseFloat(cost.Amount || 0).toFixed(2);
      const unit = cost.Unit || 'USD';
      return `Today's estimated cost: $${amount} ${unit}`;
    },
  },
];
