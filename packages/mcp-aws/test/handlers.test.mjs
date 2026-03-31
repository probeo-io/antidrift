import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'aws.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

let tools;
let toolMap;
let execSyncMock;

/**
 * Set the mock to return specific JSON data for awsCli calls.
 */
function mockAwsCli(data) {
  execSyncMock.mock.mockImplementation(() => JSON.stringify(data));
}

/**
 * Set the mock to return raw string data for awsCliRaw calls.
 */
function mockAwsCliRaw(text) {
  execSyncMock.mock.mockImplementation(() => text);
}

/**
 * Set the mock to throw an error (simulating CLI failure).
 */
function mockAwsCliError(message, code = 1) {
  execSyncMock.mock.mockImplementation(() => {
    const err = new Error(message);
    err.status = code;
    throw err;
  });
}

function handler(name) {
  return toolMap[name].handler;
}

function lastCommand() {
  const calls = execSyncMock.mock.calls;
  return calls[calls.length - 1].arguments[0];
}

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ region: 'us-west-2' }));

  // Create a shared mock function for execSync
  const mockFn = mock.fn(() => JSON.stringify({}));
  execSyncMock = mockFn;

  mock.module('child_process', {
    namedExports: {
      execSync: mockFn,
    },
  });

  // Re-export fs functions since the connector also imports from fs
  mock.module('fs', {
    namedExports: {
      existsSync,
      readFileSync,
      writeFileSync,
      mkdirSync,
      rmSync,
    },
  });

  const mod = await import('../connectors/aws.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
});

afterEach(() => {
  // Reset mock implementation to default
  execSyncMock.mock.mockImplementation(() => JSON.stringify({}));
  execSyncMock.mock.resetCalls();
});

// ---------------------------------------------------------------------------
// aws_whoami
// ---------------------------------------------------------------------------
describe('aws_whoami handler', () => {
  it('returns account, arn, and userId', async () => {
    mockAwsCli({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/testuser',
      UserId: 'AIDAEXAMPLE',
    });

    const result = await handler('aws_whoami')({});

    assert.equal(result.account, '123456789012');
    assert.equal(result.arn, 'arn:aws:iam::123456789012:user/testuser');
    assert.equal(result.userId, 'AIDAEXAMPLE');
  });

  it('calls sts get-caller-identity', async () => {
    mockAwsCli({ Account: '1', Arn: 'a', UserId: 'u' });
    await handler('aws_whoami')({});
    assert.ok(lastCommand().includes('sts get-caller-identity'));
  });

  it('includes region and output json flags', async () => {
    mockAwsCli({ Account: '1', Arn: 'a', UserId: 'u' });
    await handler('aws_whoami')({});
    const cmd = lastCommand();
    assert.ok(cmd.includes('--region'));
    assert.ok(cmd.includes('--output json'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('Unable to locate credentials');
    await assert.rejects(() => handler('aws_whoami')({}), {
      message: 'Unable to locate credentials',
    });
  });
});

// ---------------------------------------------------------------------------
// aws_s3_list_buckets
// ---------------------------------------------------------------------------
describe('aws_s3_list_buckets handler', () => {
  it('returns formatted bucket list', async () => {
    mockAwsCli({
      Buckets: [
        { Name: 'my-bucket', CreationDate: '2024-01-01T00:00:00Z' },
        { Name: 'other-bucket', CreationDate: '2024-06-15T12:00:00Z' },
      ],
    });

    const result = await handler('aws_s3_list_buckets')({});

    assert.ok(result.includes('my-bucket'));
    assert.ok(result.includes('2024-01-01'));
    assert.ok(result.includes('other-bucket'));
    assert.ok(result.includes('2024-06-15'));
  });

  it('returns "No buckets found." when empty', async () => {
    mockAwsCli({ Buckets: [] });
    const result = await handler('aws_s3_list_buckets')({});
    assert.equal(result, 'No buckets found.');
  });

  it('handles missing Buckets key', async () => {
    mockAwsCli({});
    const result = await handler('aws_s3_list_buckets')({});
    assert.equal(result, 'No buckets found.');
  });

  it('calls s3api list-buckets', async () => {
    mockAwsCli({ Buckets: [] });
    await handler('aws_s3_list_buckets')({});
    assert.ok(lastCommand().includes('s3api list-buckets'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('Access Denied');
    await assert.rejects(() => handler('aws_s3_list_buckets')({}));
  });
});

// ---------------------------------------------------------------------------
// aws_s3_list_objects
// ---------------------------------------------------------------------------
describe('aws_s3_list_objects handler', () => {
  it('returns formatted object list', async () => {
    mockAwsCli({
      Contents: [
        { Key: 'file1.txt', Size: 1024, LastModified: '2024-01-01T00:00:00Z' },
        { Key: 'dir/file2.json', Size: 2048, LastModified: '2024-06-01T00:00:00Z' },
      ],
    });

    const result = await handler('aws_s3_list_objects')({ bucket: 'my-bucket' });

    assert.ok(result.includes('file1.txt'));
    assert.ok(result.includes('1024 bytes'));
    assert.ok(result.includes('dir/file2.json'));
    assert.ok(result.includes('2048 bytes'));
  });

  it('returns "No objects found." when empty', async () => {
    mockAwsCli({ Contents: [] });
    const result = await handler('aws_s3_list_objects')({ bucket: 'empty-bucket' });
    assert.equal(result, 'No objects found.');
  });

  it('handles missing Contents key', async () => {
    mockAwsCli({});
    const result = await handler('aws_s3_list_objects')({ bucket: 'empty-bucket' });
    assert.equal(result, 'No objects found.');
  });

  it('includes bucket name in command', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'test-bucket' });
    assert.ok(lastCommand().includes('--bucket test-bucket'));
  });

  it('includes prefix when provided', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', prefix: 'logs/' });
    assert.ok(lastCommand().includes('--prefix logs/'));
  });

  it('omits prefix when not provided', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b' });
    assert.ok(!lastCommand().includes('--prefix'));
  });

  it('defaults limit to 20', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b' });
    assert.ok(lastCommand().includes('--max-keys 20'));
  });

  it('uses custom limit', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', limit: 5 });
    assert.ok(lastCommand().includes('--max-keys 5'));
  });

  it('caps limit at 1000', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', limit: 9999 });
    assert.ok(lastCommand().includes('--max-keys 1000'));
  });

  it('floors limit at 1', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', limit: -5 });
    assert.ok(lastCommand().includes('--max-keys 1'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('NoSuchBucket');
    await assert.rejects(() => handler('aws_s3_list_objects')({ bucket: 'nope' }));
  });
});

// ---------------------------------------------------------------------------
// aws_s3_get_object
// ---------------------------------------------------------------------------
describe('aws_s3_get_object handler', () => {
  it('returns file content', async () => {
    mockAwsCliRaw('Hello, world!\nLine two.');

    const result = await handler('aws_s3_get_object')({ bucket: 'my-bucket', key: 'hello.txt' });

    assert.equal(result, 'Hello, world!\nLine two.');
  });

  it('constructs s3 cp command with correct path', async () => {
    mockAwsCliRaw('content');
    await handler('aws_s3_get_object')({ bucket: 'my-bucket', key: 'path/to/file.txt' });
    const cmd = lastCommand();
    assert.ok(cmd.includes('s3 cp s3://my-bucket/path/to/file.txt -'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('NoSuchKey');
    await assert.rejects(() => handler('aws_s3_get_object')({ bucket: 'b', key: 'missing.txt' }));
  });
});

// ---------------------------------------------------------------------------
// aws_lambda_list_functions
// ---------------------------------------------------------------------------
describe('aws_lambda_list_functions handler', () => {
  it('returns formatted function list', async () => {
    mockAwsCli({
      Functions: [
        { FunctionName: 'my-func', Runtime: 'nodejs20.x', MemorySize: 128, LastModified: '2024-01-01' },
        { FunctionName: 'py-func', Runtime: 'python3.12', MemorySize: 256, LastModified: '2024-06-01' },
      ],
    });

    const result = await handler('aws_lambda_list_functions')({});

    assert.ok(result.includes('my-func'));
    assert.ok(result.includes('nodejs20.x'));
    assert.ok(result.includes('128'));
    assert.ok(result.includes('py-func'));
    assert.ok(result.includes('python3.12'));
    assert.ok(result.includes('256'));
  });

  it('returns "No Lambda functions found." when empty', async () => {
    mockAwsCli({ Functions: [] });
    const result = await handler('aws_lambda_list_functions')({});
    assert.equal(result, 'No Lambda functions found.');
  });

  it('handles missing Functions key', async () => {
    mockAwsCli({});
    const result = await handler('aws_lambda_list_functions')({});
    assert.equal(result, 'No Lambda functions found.');
  });

  it('handles function with no Runtime', async () => {
    mockAwsCli({
      Functions: [{ FunctionName: 'container-func', Runtime: null, MemorySize: 512, LastModified: '2024-01-01' }],
    });
    const result = await handler('aws_lambda_list_functions')({});
    assert.ok(result.includes('container-func'));
    assert.ok(result.includes('n/a'));
  });

  it('calls lambda list-functions', async () => {
    mockAwsCli({ Functions: [] });
    await handler('aws_lambda_list_functions')({});
    assert.ok(lastCommand().includes('lambda list-functions'));
  });
});

// ---------------------------------------------------------------------------
// aws_lambda_get_function
// ---------------------------------------------------------------------------
describe('aws_lambda_get_function handler', () => {
  it('returns full function configuration', async () => {
    const config = {
      FunctionName: 'my-func',
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      MemorySize: 128,
      Timeout: 30,
    };
    mockAwsCli(config);

    const result = await handler('aws_lambda_get_function')({ functionName: 'my-func' });

    assert.deepEqual(result, config);
  });

  it('includes function name in command', async () => {
    mockAwsCli({});
    await handler('aws_lambda_get_function')({ functionName: 'test-func' });
    assert.ok(lastCommand().includes('--function-name test-func'));
  });

  it('calls lambda get-function-configuration', async () => {
    mockAwsCli({});
    await handler('aws_lambda_get_function')({ functionName: 'f' });
    assert.ok(lastCommand().includes('lambda get-function-configuration'));
  });

  it('throws on CLI error (function not found)', async () => {
    mockAwsCliError('Function not found');
    await assert.rejects(() => handler('aws_lambda_get_function')({ functionName: 'ghost' }));
  });
});

// ---------------------------------------------------------------------------
// aws_lambda_invoke
// ---------------------------------------------------------------------------
describe('aws_lambda_invoke handler', () => {
  it('returns parsed JSON response', async () => {
    mockAwsCliRaw('{"statusCode": 200, "body": "ok"}');

    const result = await handler('aws_lambda_invoke')({ functionName: 'my-func' });

    assert.deepEqual(result, { statusCode: 200, body: 'ok' });
  });

  it('returns raw string when response is not JSON', async () => {
    mockAwsCliRaw('plain text response');

    const result = await handler('aws_lambda_invoke')({ functionName: 'my-func' });

    assert.equal(result, 'plain text response');
  });

  it('includes payload when provided', async () => {
    mockAwsCliRaw('{}');
    await handler('aws_lambda_invoke')({ functionName: 'f', payload: '{"key":"value"}' });
    const cmd = lastCommand();
    assert.ok(cmd.includes('--payload'));
  });

  it('omits payload when not provided', async () => {
    mockAwsCliRaw('{}');
    await handler('aws_lambda_invoke')({ functionName: 'f' });
    assert.ok(!lastCommand().includes('--payload'));
  });

  it('outputs to /dev/stdout', async () => {
    mockAwsCliRaw('{}');
    await handler('aws_lambda_invoke')({ functionName: 'f' });
    assert.ok(lastCommand().includes('/dev/stdout'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('ResourceNotFoundException');
    await assert.rejects(() => handler('aws_lambda_invoke')({ functionName: 'ghost' }));
  });
});

// ---------------------------------------------------------------------------
// aws_ecs_list_clusters
// ---------------------------------------------------------------------------
describe('aws_ecs_list_clusters handler', () => {
  it('returns formatted cluster names extracted from ARNs', async () => {
    mockAwsCli({
      clusterArns: [
        'arn:aws:ecs:us-east-1:123456789012:cluster/production',
        'arn:aws:ecs:us-east-1:123456789012:cluster/staging',
      ],
    });

    const result = await handler('aws_ecs_list_clusters')({});

    assert.ok(result.includes('production'));
    assert.ok(result.includes('staging'));
  });

  it('returns "No ECS clusters found." when empty', async () => {
    mockAwsCli({ clusterArns: [] });
    const result = await handler('aws_ecs_list_clusters')({});
    assert.equal(result, 'No ECS clusters found.');
  });

  it('handles missing clusterArns key', async () => {
    mockAwsCli({});
    const result = await handler('aws_ecs_list_clusters')({});
    assert.equal(result, 'No ECS clusters found.');
  });

  it('calls ecs list-clusters', async () => {
    mockAwsCli({ clusterArns: [] });
    await handler('aws_ecs_list_clusters')({});
    assert.ok(lastCommand().includes('ecs list-clusters'));
  });
});

// ---------------------------------------------------------------------------
// aws_ecs_list_services
// ---------------------------------------------------------------------------
describe('aws_ecs_list_services handler', () => {
  it('returns service names extracted from ARNs', async () => {
    mockAwsCli({
      serviceArns: [
        'arn:aws:ecs:us-east-1:123456789012:service/prod/api-svc',
        'arn:aws:ecs:us-east-1:123456789012:service/prod/web-svc',
      ],
    });

    const result = await handler('aws_ecs_list_services')({ cluster: 'prod' });

    assert.ok(result.includes('api-svc'));
    assert.ok(result.includes('web-svc'));
  });

  it('returns "No services found in this cluster." when empty', async () => {
    mockAwsCli({ serviceArns: [] });
    const result = await handler('aws_ecs_list_services')({ cluster: 'empty' });
    assert.equal(result, 'No services found in this cluster.');
  });

  it('includes cluster name in command', async () => {
    mockAwsCli({ serviceArns: [] });
    await handler('aws_ecs_list_services')({ cluster: 'my-cluster' });
    assert.ok(lastCommand().includes('--cluster my-cluster'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('ClusterNotFoundException');
    await assert.rejects(() => handler('aws_ecs_list_services')({ cluster: 'nope' }));
  });
});

// ---------------------------------------------------------------------------
// aws_ecs_describe_service
// ---------------------------------------------------------------------------
describe('aws_ecs_describe_service handler', () => {
  it('returns formatted service details with events', async () => {
    mockAwsCli({
      services: [{
        serviceName: 'api-svc',
        status: 'ACTIVE',
        runningCount: 3,
        desiredCount: 3,
        taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/api:5',
        launchType: 'FARGATE',
        events: [
          { createdAt: '2024-01-01T12:00:00Z', message: 'service has reached a steady state.' },
          { createdAt: '2024-01-01T11:00:00Z', message: 'registered 1 target.' },
        ],
      }],
    });

    const result = await handler('aws_ecs_describe_service')({ cluster: 'prod', service: 'api-svc' });

    assert.ok(result.includes('api-svc'));
    assert.ok(result.includes('ACTIVE'));
    assert.ok(result.includes('3'));
    assert.ok(result.includes('FARGATE'));
    assert.ok(result.includes('steady state'));
    assert.ok(result.includes('Recent Events'));
  });

  it('returns "Service not found." when services array is empty', async () => {
    mockAwsCli({ services: [] });
    const result = await handler('aws_ecs_describe_service')({ cluster: 'c', service: 's' });
    assert.equal(result, 'Service not found.');
  });

  it('handles service with no events', async () => {
    mockAwsCli({
      services: [{
        serviceName: 'svc',
        status: 'ACTIVE',
        runningCount: 1,
        desiredCount: 1,
        taskDefinition: 'td',
        launchType: 'EC2',
        events: [],
      }],
    });
    const result = await handler('aws_ecs_describe_service')({ cluster: 'c', service: 's' });
    assert.ok(result.includes('svc'));
    assert.ok(result.includes('Recent Events'));
  });

  it('handles service with no launchType', async () => {
    mockAwsCli({
      services: [{
        serviceName: 'svc',
        status: 'ACTIVE',
        runningCount: 0,
        desiredCount: 0,
        taskDefinition: 'td',
      }],
    });
    const result = await handler('aws_ecs_describe_service')({ cluster: 'c', service: 's' });
    assert.ok(result.includes('n/a'));
  });

  it('includes cluster and service in command', async () => {
    mockAwsCli({ services: [] });
    await handler('aws_ecs_describe_service')({ cluster: 'prod', service: 'web' });
    const cmd = lastCommand();
    assert.ok(cmd.includes('--cluster prod'));
    assert.ok(cmd.includes('--services web'));
  });

  it('limits events to 5', async () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      createdAt: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`,
      message: `event ${i}`,
    }));
    mockAwsCli({
      services: [{
        serviceName: 'svc', status: 'ACTIVE', runningCount: 1, desiredCount: 1,
        taskDefinition: 'td', launchType: 'EC2', events,
      }],
    });
    const result = await handler('aws_ecs_describe_service')({ cluster: 'c', service: 's' });
    // Should include events 0-4, not 5-9
    assert.ok(result.includes('event 0'));
    assert.ok(result.includes('event 4'));
    assert.ok(!result.includes('event 5'));
  });
});

// ---------------------------------------------------------------------------
// aws_logs_list_groups
// ---------------------------------------------------------------------------
describe('aws_logs_list_groups handler', () => {
  it('returns formatted log groups with storage size', async () => {
    mockAwsCli({
      logGroups: [
        { logGroupName: '/aws/lambda/my-func', storedBytes: 10485760 },
        { logGroupName: '/aws/ecs/web', storedBytes: 5242880 },
      ],
    });

    const result = await handler('aws_logs_list_groups')({});

    assert.ok(result.includes('/aws/lambda/my-func'));
    assert.ok(result.includes('10.0MB'));
    assert.ok(result.includes('/aws/ecs/web'));
    assert.ok(result.includes('5.0MB'));
  });

  it('returns "No log groups found." when empty', async () => {
    mockAwsCli({ logGroups: [] });
    const result = await handler('aws_logs_list_groups')({});
    assert.equal(result, 'No log groups found.');
  });

  it('shows n/a when storedBytes is null', async () => {
    mockAwsCli({
      logGroups: [{ logGroupName: '/test', storedBytes: null }],
    });
    const result = await handler('aws_logs_list_groups')({});
    assert.ok(result.includes('n/a'));
  });

  it('defaults limit to 50', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({});
    assert.ok(lastCommand().includes('--limit 50'));
  });

  it('uses custom limit', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({ limit: 10 });
    assert.ok(lastCommand().includes('--limit 10'));
  });

  it('caps limit at 50', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({ limit: 200 });
    assert.ok(lastCommand().includes('--limit 50'));
  });
});

// ---------------------------------------------------------------------------
// aws_logs_tail
// ---------------------------------------------------------------------------
describe('aws_logs_tail handler', () => {
  it('returns formatted log events with timestamps', async () => {
    mockAwsCli({
      events: [
        { timestamp: 1704067200000, message: 'START RequestId: abc-123' },
        { timestamp: 1704067201000, message: 'END RequestId: abc-123' },
      ],
    });

    const result = await handler('aws_logs_tail')({ logGroup: '/aws/lambda/my-func' });

    assert.ok(result.includes('START RequestId: abc-123'));
    assert.ok(result.includes('END RequestId: abc-123'));
    assert.ok(result.includes('2024-'));
  });

  it('returns "No recent log events." when empty', async () => {
    mockAwsCli({ events: [] });
    const result = await handler('aws_logs_tail')({ logGroup: '/aws/lambda/test' });
    assert.equal(result, 'No recent log events.');
  });

  it('includes log group name in command', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/aws/lambda/my-func' });
    assert.ok(lastCommand().includes('--log-group-name /aws/lambda/my-func'));
  });

  it('defaults limit to 20', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test' });
    assert.ok(lastCommand().includes('--limit 20'));
  });

  it('uses custom limit', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test', limit: 5 });
    assert.ok(lastCommand().includes('--limit 5'));
  });

  it('caps limit at 100', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test', limit: 500 });
    assert.ok(lastCommand().includes('--limit 100'));
  });

  it('includes --interleaved flag', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test' });
    assert.ok(lastCommand().includes('--interleaved'));
  });
});

// ---------------------------------------------------------------------------
// aws_sqs_list_queues
// ---------------------------------------------------------------------------
describe('aws_sqs_list_queues handler', () => {
  it('returns formatted queue list with names and URLs', async () => {
    mockAwsCli({
      QueueUrls: [
        'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
        'https://sqs.us-east-1.amazonaws.com/123456789012/dlq',
      ],
    });

    const result = await handler('aws_sqs_list_queues')({});

    assert.ok(result.includes('my-queue'));
    assert.ok(result.includes('dlq'));
    assert.ok(result.includes('https://sqs.us-east-1.amazonaws.com'));
  });

  it('returns "No SQS queues found." when empty', async () => {
    mockAwsCli({ QueueUrls: [] });
    const result = await handler('aws_sqs_list_queues')({});
    assert.equal(result, 'No SQS queues found.');
  });

  it('handles missing QueueUrls key', async () => {
    mockAwsCli({});
    const result = await handler('aws_sqs_list_queues')({});
    assert.equal(result, 'No SQS queues found.');
  });

  it('calls sqs list-queues', async () => {
    mockAwsCli({ QueueUrls: [] });
    await handler('aws_sqs_list_queues')({});
    assert.ok(lastCommand().includes('sqs list-queues'));
  });
});

// ---------------------------------------------------------------------------
// aws_sqs_get_queue_attributes
// ---------------------------------------------------------------------------
describe('aws_sqs_get_queue_attributes handler', () => {
  it('returns formatted queue attributes', async () => {
    mockAwsCli({
      Attributes: {
        ApproximateNumberOfMessages: '5',
        ApproximateNumberOfMessagesNotVisible: '2',
        ApproximateNumberOfMessagesDelayed: '0',
        MessageRetentionPeriod: '345600',
        VisibilityTimeout: '30',
        CreatedTimestamp: '1704067200',
      },
    });

    const result = await handler('aws_sqs_get_queue_attributes')({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    });

    assert.ok(result.includes('my-queue'));
    assert.ok(result.includes('Messages Available: 5'));
    assert.ok(result.includes('Messages In Flight: 2'));
    assert.ok(result.includes('Messages Delayed: 0'));
    assert.ok(result.includes('4 days'));
    assert.ok(result.includes('30s'));
  });

  it('includes queue URL and All attribute names in command', async () => {
    mockAwsCli({ Attributes: {} });
    await handler('aws_sqs_get_queue_attributes')({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/q',
    });
    const cmd = lastCommand();
    assert.ok(cmd.includes('--queue-url'));
    assert.ok(cmd.includes('--attribute-names All'));
  });

  it('handles missing attributes gracefully', async () => {
    mockAwsCli({ Attributes: {} });
    const result = await handler('aws_sqs_get_queue_attributes')({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/q',
    });
    assert.ok(result.includes('Messages Available: 0'));
    assert.ok(result.includes('0s'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('NonExistentQueue');
    await assert.rejects(() => handler('aws_sqs_get_queue_attributes')({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/nope',
    }));
  });
});

// ---------------------------------------------------------------------------
// aws_cost_today
// ---------------------------------------------------------------------------
describe('aws_cost_today handler', () => {
  it('returns formatted cost string', async () => {
    mockAwsCli({
      ResultsByTime: [{
        Total: {
          UnblendedCost: { Amount: '3.14159', Unit: 'USD' },
        },
      }],
    });

    const result = await handler('aws_cost_today')({});

    assert.ok(result.includes('$3.14'));
    assert.ok(result.includes('USD'));
  });

  it('returns "No cost data available" when no results', async () => {
    mockAwsCli({ ResultsByTime: [] });
    const result = await handler('aws_cost_today')({});
    assert.equal(result, 'No cost data available for today.');
  });

  it('returns "No cost data available" when Total is missing', async () => {
    mockAwsCli({ ResultsByTime: [{ Total: {} }] });
    const result = await handler('aws_cost_today')({});
    assert.equal(result, 'No cost data available for today.');
  });

  it('calls ce get-cost-and-usage with correct flags', async () => {
    mockAwsCli({ ResultsByTime: [] });
    await handler('aws_cost_today')({});
    const cmd = lastCommand();
    assert.ok(cmd.includes('ce get-cost-and-usage'));
    assert.ok(cmd.includes('--granularity DAILY'));
    assert.ok(cmd.includes('--metrics UnblendedCost'));
    assert.ok(cmd.includes('--time-period'));
  });

  it('throws on CLI error', async () => {
    mockAwsCliError('AccessDeniedException');
    await assert.rejects(() => handler('aws_cost_today')({}));
  });
});
