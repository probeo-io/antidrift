import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'aws.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

let tools;
let toolMap;
let execSyncMock;

function mockAwsCli(data) {
  execSyncMock.mock.mockImplementation(() => JSON.stringify(data));
}

function mockAwsCliRaw(text) {
  execSyncMock.mock.mockImplementation(() => text);
}

function mockAwsCliError(message) {
  execSyncMock.mock.mockImplementation(() => {
    throw new Error(message);
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
  writeFileSync(CONFIG_PATH, JSON.stringify({ region: 'eu-west-1' }));

  const mockFn = mock.fn(() => JSON.stringify({}));
  execSyncMock = mockFn;

  mock.module('child_process', {
    namedExports: {
      execSync: mockFn,
    },
  });

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
  execSyncMock.mock.mockImplementation(() => JSON.stringify({}));
  execSyncMock.mock.resetCalls();
});

// ---------------------------------------------------------------------------
// Missing required parameters
// ---------------------------------------------------------------------------
describe('missing required parameters', () => {
  it('aws_s3_list_objects without bucket still calls CLI (bucket is sanitized)', async () => {
    mockAwsCli({ Contents: [] });
    // The connector does not validate params itself - it passes sanitized values to CLI
    // which would fail at the CLI level. We just verify it doesn't crash in JS.
    const result = await handler('aws_s3_list_objects')({});
    assert.equal(result, 'No objects found.');
  });

  it('aws_s3_get_object without bucket/key constructs command with empty strings', async () => {
    mockAwsCliRaw('');
    await handler('aws_s3_get_object')({});
    const cmd = lastCommand();
    assert.ok(cmd.includes('s3 cp s3://'));
  });

  it('aws_lambda_get_function without functionName still calls CLI', async () => {
    mockAwsCli({});
    await handler('aws_lambda_get_function')({});
    assert.ok(lastCommand().includes('lambda get-function-configuration'));
  });

  it('aws_ecs_list_services without cluster still calls CLI', async () => {
    mockAwsCli({ serviceArns: [] });
    await handler('aws_ecs_list_services')({});
    assert.ok(lastCommand().includes('ecs list-services'));
  });

  it('aws_ecs_describe_service without cluster/service still calls CLI', async () => {
    mockAwsCli({ services: [] });
    await handler('aws_ecs_describe_service')({});
    assert.ok(lastCommand().includes('ecs describe-services'));
  });

  it('aws_logs_tail without logGroup still calls CLI', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({});
    assert.ok(lastCommand().includes('logs filter-log-events'));
  });

  it('aws_sqs_get_queue_attributes without queueUrl throws (split on undefined)', async () => {
    mockAwsCli({ Attributes: {} });
    await assert.rejects(() => handler('aws_sqs_get_queue_attributes')({}), TypeError);
  });
});

// ---------------------------------------------------------------------------
// Pagination / limit parameters
// ---------------------------------------------------------------------------
describe('pagination and limit parameters', () => {
  it('aws_s3_list_objects with string limit parses to number', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', limit: '15' });
    assert.ok(lastCommand().includes('--max-keys 15'));
  });

  it('aws_s3_list_objects with NaN limit defaults to 20', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', limit: 'abc' });
    assert.ok(lastCommand().includes('--max-keys 20'));
  });

  it('aws_s3_list_objects with zero limit defaults to 20 (falsy coercion)', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', limit: 0 });
    // parseInt(0) || 20 => 20 because 0 is falsy
    assert.ok(lastCommand().includes('--max-keys 20'));
  });

  it('aws_logs_list_groups with string limit', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({ limit: '25' });
    assert.ok(lastCommand().includes('--limit 25'));
  });

  it('aws_logs_list_groups with NaN limit defaults to 50', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({ limit: 'xyz' });
    assert.ok(lastCommand().includes('--limit 50'));
  });

  it('aws_logs_list_groups with zero limit defaults to 50 (falsy coercion)', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({ limit: 0 });
    // parseInt(0) || 50 => 50 because 0 is falsy
    assert.ok(lastCommand().includes('--limit 50'));
  });

  it('aws_logs_tail with string limit', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test', limit: '50' });
    assert.ok(lastCommand().includes('--limit 50'));
  });

  it('aws_logs_tail with NaN limit defaults to 20', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test', limit: 'bad' });
    assert.ok(lastCommand().includes('--limit 20'));
  });

  it('aws_logs_tail with zero limit defaults to 20 (falsy coercion)', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test', limit: 0 });
    // parseInt(0) || 20 => 20 because 0 is falsy
    assert.ok(lastCommand().includes('--limit 20'));
  });
});

// ---------------------------------------------------------------------------
// Optional params omitted from request
// ---------------------------------------------------------------------------
describe('optional params omitted from request', () => {
  it('aws_s3_list_objects omits prefix when undefined', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', prefix: undefined });
    assert.ok(!lastCommand().includes('--prefix'));
  });

  it('aws_s3_list_objects omits prefix when empty string', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'b', prefix: '' });
    assert.ok(!lastCommand().includes('--prefix'));
  });

  it('aws_lambda_invoke omits payload when undefined', async () => {
    mockAwsCliRaw('{}');
    await handler('aws_lambda_invoke')({ functionName: 'f', payload: undefined });
    assert.ok(!lastCommand().includes('--payload'));
  });

  it('aws_lambda_invoke omits payload when empty string', async () => {
    mockAwsCliRaw('{}');
    await handler('aws_lambda_invoke')({ functionName: 'f', payload: '' });
    assert.ok(!lastCommand().includes('--payload'));
  });

  it('aws_logs_list_groups uses default limit when not provided', async () => {
    mockAwsCli({ logGroups: [] });
    await handler('aws_logs_list_groups')({});
    assert.ok(lastCommand().includes('--limit 50'));
  });

  it('aws_logs_tail uses default limit when not provided', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/test' });
    assert.ok(lastCommand().includes('--limit 20'));
  });
});

// ---------------------------------------------------------------------------
// Special characters in input (sanitization)
// ---------------------------------------------------------------------------
describe('special characters in input', () => {
  it('bucket names with dots are preserved', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'my.dotted.bucket.name' });
    assert.ok(lastCommand().includes('my.dotted.bucket.name'));
  });

  it('bucket names with hyphens are preserved', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'my-bucket-name' });
    assert.ok(lastCommand().includes('my-bucket-name'));
  });

  it('keys with slashes are preserved', async () => {
    mockAwsCliRaw('content');
    await handler('aws_s3_get_object')({ bucket: 'b', key: 'path/to/deep/file.txt' });
    assert.ok(lastCommand().includes('path/to/deep/file.txt'));
  });

  it('function names with hyphens and underscores are preserved', async () => {
    mockAwsCli({});
    await handler('aws_lambda_get_function')({ functionName: 'my-func_v2' });
    assert.ok(lastCommand().includes('my-func_v2'));
  });

  it('shell injection semicolons are stripped from bucket name', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'bucket; rm -rf /' });
    const cmd = lastCommand();
    // Sanitize strips semicolons and other dangerous chars, but alphanumeric/spaces/hyphens/slashes remain
    assert.ok(!cmd.includes(';'));
  });

  it('backtick injection is stripped', async () => {
    mockAwsCli({ Contents: [] });
    await handler('aws_s3_list_objects')({ bucket: 'bucket`whoami`' });
    const cmd = lastCommand();
    assert.ok(!cmd.includes('`'));
  });

  it('dollar sign injection is stripped', async () => {
    mockAwsCli({});
    await handler('aws_lambda_get_function')({ functionName: 'func$(id)' });
    const cmd = lastCommand();
    assert.ok(!cmd.includes('$'));
    assert.ok(!cmd.includes('('));
  });

  it('pipe injection is stripped', async () => {
    mockAwsCli({ serviceArns: [] });
    await handler('aws_ecs_list_services')({ cluster: 'prod | cat /etc/passwd' });
    const cmd = lastCommand();
    assert.ok(!cmd.includes('|'));
  });

  it('log group names with forward slashes are preserved', async () => {
    mockAwsCli({ events: [] });
    await handler('aws_logs_tail')({ logGroup: '/aws/lambda/my-func' });
    assert.ok(lastCommand().includes('/aws/lambda/my-func'));
  });

  it('ARN-like function names with colons are preserved', async () => {
    mockAwsCli({});
    await handler('aws_lambda_get_function')({
      functionName: 'arn:aws:lambda:us-east-1:123456789012:function:my-func',
    });
    assert.ok(lastCommand().includes('arn:aws:lambda:us-east-1:123456789012:function:my-func'));
  });

  it('queue URL with special characters is sanitized', async () => {
    mockAwsCli({ Attributes: {} });
    await handler('aws_sqs_get_queue_attributes')({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/queue; echo pwned',
    });
    const cmd = lastCommand();
    assert.ok(!cmd.includes(';'));
  });
});

// ---------------------------------------------------------------------------
// Large response handling
// ---------------------------------------------------------------------------
describe('large response handling', () => {
  it('aws_s3_list_objects handles many objects', async () => {
    const contents = Array.from({ length: 100 }, (_, i) => ({
      Key: `file-${i}.txt`,
      Size: i * 100,
      LastModified: '2024-01-01T00:00:00Z',
    }));
    mockAwsCli({ Contents: contents });

    const result = await handler('aws_s3_list_objects')({ bucket: 'big' });
    const lines = result.split('\n');
    assert.equal(lines.length, 100);
    assert.ok(result.includes('file-0.txt'));
    assert.ok(result.includes('file-99.txt'));
  });

  it('aws_lambda_list_functions handles many functions', async () => {
    const functions = Array.from({ length: 50 }, (_, i) => ({
      FunctionName: `func-${i}`,
      Runtime: 'nodejs20.x',
      MemorySize: 128,
      LastModified: '2024-01-01',
    }));
    mockAwsCli({ Functions: functions });

    const result = await handler('aws_lambda_list_functions')({});
    assert.ok(result.includes('func-0'));
    assert.ok(result.includes('func-49'));
  });

  it('aws_ecs_list_clusters handles many clusters', async () => {
    const arns = Array.from({ length: 30 }, (_, i) =>
      `arn:aws:ecs:us-east-1:123:cluster/cluster-${i}`
    );
    mockAwsCli({ clusterArns: arns });

    const result = await handler('aws_ecs_list_clusters')({});
    assert.ok(result.includes('cluster-0'));
    assert.ok(result.includes('cluster-29'));
  });

  it('aws_logs_tail handles many events', async () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      timestamp: 1704067200000 + i * 1000,
      message: `log line ${i}`,
    }));
    mockAwsCli({ events });

    const result = await handler('aws_logs_tail')({ logGroup: '/test' });
    assert.ok(result.includes('log line 0'));
    assert.ok(result.includes('log line 99'));
  });

  it('aws_sqs_list_queues handles many queues', async () => {
    const urls = Array.from({ length: 20 }, (_, i) =>
      `https://sqs.us-east-1.amazonaws.com/123/queue-${i}`
    );
    mockAwsCli({ QueueUrls: urls });

    const result = await handler('aws_sqs_list_queues')({});
    assert.ok(result.includes('queue-0'));
    assert.ok(result.includes('queue-19'));
  });
});

// ---------------------------------------------------------------------------
// Region configuration
// ---------------------------------------------------------------------------
describe('region configuration', () => {
  it('commands include region flag', async () => {
    mockAwsCli({ Buckets: [] });
    await handler('aws_s3_list_buckets')({});
    assert.ok(lastCommand().includes('--region'));
  });
});

// ---------------------------------------------------------------------------
// Response format edge cases
// ---------------------------------------------------------------------------
describe('response format edge cases', () => {
  it('aws_s3_list_buckets with single bucket', async () => {
    mockAwsCli({
      Buckets: [{ Name: 'solo', CreationDate: '2024-01-01' }],
    });
    const result = await handler('aws_s3_list_buckets')({});
    assert.ok(result.includes('solo'));
    // Single item should not have extra newlines
    assert.ok(!result.startsWith('\n'));
  });

  it('aws_lambda_invoke returns parsed object for JSON response', async () => {
    mockAwsCliRaw('{"key": "value", "nested": {"a": 1}}');
    const result = await handler('aws_lambda_invoke')({ functionName: 'f' });
    assert.equal(typeof result, 'object');
    assert.equal(result.key, 'value');
    assert.equal(result.nested.a, 1);
  });

  it('aws_lambda_invoke returns string for non-JSON response', async () => {
    mockAwsCliRaw('just a string');
    const result = await handler('aws_lambda_invoke')({ functionName: 'f' });
    assert.equal(typeof result, 'string');
    assert.equal(result, 'just a string');
  });

  it('aws_cost_today formats amount to 2 decimal places', async () => {
    mockAwsCli({
      ResultsByTime: [{
        Total: { UnblendedCost: { Amount: '0.123456789', Unit: 'USD' } },
      }],
    });
    const result = await handler('aws_cost_today')({});
    assert.ok(result.includes('$0.12'));
  });

  it('aws_cost_today handles zero cost', async () => {
    mockAwsCli({
      ResultsByTime: [{
        Total: { UnblendedCost: { Amount: '0', Unit: 'USD' } },
      }],
    });
    const result = await handler('aws_cost_today')({});
    assert.ok(result.includes('$0.00'));
  });

  it('aws_ecs_describe_service shows running vs desired count', async () => {
    mockAwsCli({
      services: [{
        serviceName: 'scaling-svc',
        status: 'ACTIVE',
        runningCount: 2,
        desiredCount: 5,
        taskDefinition: 'td',
        launchType: 'FARGATE',
        events: [],
      }],
    });
    const result = await handler('aws_ecs_describe_service')({ cluster: 'c', service: 's' });
    assert.ok(result.includes('2'));
    assert.ok(result.includes('5'));
    assert.ok(result.includes('Running:'));
  });

  it('aws_sqs_get_queue_attributes calculates retention in days', async () => {
    // 7 days = 604800 seconds
    mockAwsCli({
      Attributes: {
        MessageRetentionPeriod: '604800',
        VisibilityTimeout: '60',
        CreatedTimestamp: '1704067200',
      },
    });
    const result = await handler('aws_sqs_get_queue_attributes')({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/q',
    });
    assert.ok(result.includes('7 days'));
  });

  it('aws_logs_list_groups calculates MB from bytes', async () => {
    // 1 MB = 1048576 bytes
    mockAwsCli({
      logGroups: [{ logGroupName: '/test', storedBytes: 1048576 }],
    });
    const result = await handler('aws_logs_list_groups')({});
    assert.ok(result.includes('1.0MB'));
  });

  it('aws_logs_tail trims message whitespace', async () => {
    mockAwsCli({
      events: [{ timestamp: 1704067200000, message: '  padded message  \n' }],
    });
    const result = await handler('aws_logs_tail')({ logGroup: '/test' });
    assert.ok(result.includes('padded message'));
    // Should not have trailing whitespace in the message part
    assert.ok(!result.endsWith('  \n'));
  });

  it('aws_s3_get_object returns empty string for empty file', async () => {
    mockAwsCliRaw('');
    const result = await handler('aws_s3_get_object')({ bucket: 'b', key: 'empty.txt' });
    assert.equal(result, '');
  });
});
