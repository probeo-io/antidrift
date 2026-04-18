/**
 * Comprehensive unit tests for mcp-aws tools/*.mjs (zeromcp format).
 *
 * Each tool exports { description, input, execute } where
 * execute(args, ctx) receives ctx.credentials which contains { region }.
 * createClient(credentials) uses execSync internally.
 *
 * Strategy: mock child_process.execSync before importing tools so
 * createClient returns awsCli/awsCliRaw functions that call our mock.
 */
import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// execSync mock — installed before any tool imports
// ---------------------------------------------------------------------------
let execSyncImpl = () => JSON.stringify({});

const mockExecSync = mock.fn((...args) => execSyncImpl(...args));

await mock.module('child_process', {
  namedExports: { execSync: mockExecSync }
});

// Helpers
function mockCli(data) {
  execSyncImpl = () => JSON.stringify(data);
}
function mockCliRaw(text) {
  execSyncImpl = () => text;
}
function mockCliError(msg) {
  execSyncImpl = () => { throw new Error(msg); };
}
function lastCmd() {
  const calls = mockExecSync.mock.calls;
  return calls[calls.length - 1].arguments[0];
}

// Base ctx for zeromcp execute calls
function ctx(region = 'us-east-1') {
  return { credentials: { region }, fetch: globalThis.fetch };
}

// ---------------------------------------------------------------------------
// Import all tools after mock installed
// ---------------------------------------------------------------------------
let toolModules;

before(async () => {
  toolModules = {
    whoami:                   (await import('../tools/whoami.mjs')).default,
    cost_today:               (await import('../tools/cost_today.mjs')).default,
    ecs_list_clusters:        (await import('../tools/ecs_list_clusters.mjs')).default,
    ecs_list_services:        (await import('../tools/ecs_list_services.mjs')).default,
    ecs_describe_service:     (await import('../tools/ecs_describe_service.mjs')).default,
    lambda_list_functions:    (await import('../tools/lambda_list_functions.mjs')).default,
    lambda_get_function:      (await import('../tools/lambda_get_function.mjs')).default,
    lambda_invoke:            (await import('../tools/lambda_invoke.mjs')).default,
    logs_list_groups:         (await import('../tools/logs_list_groups.mjs')).default,
    logs_tail:                (await import('../tools/logs_tail.mjs')).default,
    s3_list_buckets:          (await import('../tools/s3_list_buckets.mjs')).default,
    s3_list_objects:          (await import('../tools/s3_list_objects.mjs')).default,
    s3_get_object:            (await import('../tools/s3_get_object.mjs')).default,
    sqs_list_queues:          (await import('../tools/sqs_list_queues.mjs')).default,
    sqs_get_queue_attributes: (await import('../tools/sqs_get_queue_attributes.mjs')).default,
  };
});

afterEach(() => {
  execSyncImpl = () => JSON.stringify({});
  mockExecSync.mock.resetCalls();
});

// ---------------------------------------------------------------------------
// Tool structure validation
// ---------------------------------------------------------------------------
describe('tool structure', () => {
  it('every tool exports description, input, execute', () => {
    for (const [name, tool] of Object.entries(toolModules)) {
      assert.equal(typeof tool.description, 'string', `${name}: description must be string`);
      assert.ok(tool.description.length > 0, `${name}: description must be non-empty`);
      assert.ok(tool.input !== null && typeof tool.input === 'object', `${name}: input must be object`);
      assert.equal(typeof tool.execute, 'function', `${name}: execute must be function`);
    }
  });

  it('every tool input property has type and description', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const [name, tool] of Object.entries(toolModules)) {
      for (const [key, prop] of Object.entries(tool.input)) {
        assert.ok(typeof prop.type === 'string', `${name}.input.${key}: must have type`);
        assert.ok(validTypes.includes(prop.type), `${name}.input.${key}: invalid type '${prop.type}'`);
        assert.ok(typeof prop.description === 'string', `${name}.input.${key}: must have description`);
      }
    }
  });

  it('has 15 tool files', () => {
    assert.equal(Object.keys(toolModules).length, 15);
  });
});

// ---------------------------------------------------------------------------
// whoami
// ---------------------------------------------------------------------------
describe('whoami', () => {
  it('returns account, arn, userId', async () => {
    mockCli({ Account: '123456789', Arn: 'arn:aws:iam::123:user/test', UserId: 'AIDAEXAMPLE' });
    const result = await toolModules.whoami.execute({}, ctx());
    assert.equal(result.account, '123456789');
    assert.equal(result.arn, 'arn:aws:iam::123:user/test');
    assert.equal(result.userId, 'AIDAEXAMPLE');
  });

  it('calls sts get-caller-identity', async () => {
    mockCli({ Account: '1', Arn: 'a', UserId: 'u' });
    await toolModules.whoami.execute({}, ctx());
    assert.ok(lastCmd().includes('sts get-caller-identity'));
  });

  it('propagates CLI error', async () => {
    mockCliError('UnauthorizedException');
    await assert.rejects(() => toolModules.whoami.execute({}, ctx()), /UnauthorizedException/);
  });
});

// ---------------------------------------------------------------------------
// cost_today
// ---------------------------------------------------------------------------
describe('cost_today', () => {
  it('returns formatted cost string', async () => {
    mockCli({
      ResultsByTime: [{ Total: { UnblendedCost: { Amount: '42.5678', Unit: 'USD' } } }]
    });
    const result = await toolModules.cost_today.execute({}, ctx());
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('$42.57'));
  });

  it('returns no-data message when ResultsByTime is empty', async () => {
    mockCli({ ResultsByTime: [] });
    const result = await toolModules.cost_today.execute({}, ctx());
    assert.ok(result.includes('No cost data'));
  });

  it('returns no-data message when UnblendedCost missing', async () => {
    mockCli({ ResultsByTime: [{ Total: {} }] });
    const result = await toolModules.cost_today.execute({}, ctx());
    assert.ok(result.includes('No cost data'));
  });

  it('formats zero cost to $0.00', async () => {
    mockCli({
      ResultsByTime: [{ Total: { UnblendedCost: { Amount: '0', Unit: 'USD' } } }]
    });
    const result = await toolModules.cost_today.execute({}, ctx());
    assert.ok(result.includes('$0.00'));
  });

  it('includes the unit (USD) in output', async () => {
    mockCli({
      ResultsByTime: [{ Total: { UnblendedCost: { Amount: '5', Unit: 'USD' } } }]
    });
    const result = await toolModules.cost_today.execute({}, ctx());
    assert.ok(result.includes('USD'));
  });
});

// ---------------------------------------------------------------------------
// ecs_list_clusters
// ---------------------------------------------------------------------------
describe('ecs_list_clusters', () => {
  it('returns cluster names from ARNs', async () => {
    mockCli({ clusterArns: ['arn:aws:ecs:us-east-1:123:cluster/prod', 'arn:aws:ecs:us-east-1:123:cluster/staging'] });
    const result = await toolModules.ecs_list_clusters.execute({}, ctx());
    assert.ok(result.includes('prod'));
    assert.ok(result.includes('staging'));
  });

  it('returns no-clusters message when empty', async () => {
    mockCli({ clusterArns: [] });
    const result = await toolModules.ecs_list_clusters.execute({}, ctx());
    assert.ok(result.includes('No ECS clusters'));
  });

  it('calls ecs list-clusters', async () => {
    mockCli({ clusterArns: [] });
    await toolModules.ecs_list_clusters.execute({}, ctx());
    assert.ok(lastCmd().includes('ecs list-clusters'));
  });
});

// ---------------------------------------------------------------------------
// ecs_list_services
// ---------------------------------------------------------------------------
describe('ecs_list_services', () => {
  it('returns service names from ARNs', async () => {
    mockCli({
      serviceArns: [
        'arn:aws:ecs:us-east-1:123:service/prod/api',
        'arn:aws:ecs:us-east-1:123:service/prod/worker'
      ]
    });
    const result = await toolModules.ecs_list_services.execute({ cluster: 'prod' }, ctx());
    assert.ok(result.includes('api'));
    assert.ok(result.includes('worker'));
  });

  it('includes cluster name in command', async () => {
    mockCli({ serviceArns: [] });
    await toolModules.ecs_list_services.execute({ cluster: 'my-cluster' }, ctx());
    assert.ok(lastCmd().includes('my-cluster'));
    assert.ok(lastCmd().includes('ecs list-services'));
  });

  it('returns no-services message when empty', async () => {
    mockCli({ serviceArns: [] });
    const result = await toolModules.ecs_list_services.execute({ cluster: 'prod' }, ctx());
    assert.ok(result.includes('No services'));
  });
});

// ---------------------------------------------------------------------------
// ecs_describe_service
// ---------------------------------------------------------------------------
describe('ecs_describe_service', () => {
  it('returns service details', async () => {
    mockCli({
      services: [{
        serviceName: 'api-svc',
        status: 'ACTIVE',
        runningCount: 3,
        desiredCount: 3,
        taskDefinition: 'api:5',
        launchType: 'FARGATE',
        events: [{ createdAt: '2024-01-01T00:00:00', message: 'service reached steady state' }]
      }]
    });
    const result = await toolModules.ecs_describe_service.execute({ cluster: 'prod', service: 'api-svc' }, ctx());
    assert.ok(result.includes('api-svc'));
    assert.ok(result.includes('ACTIVE'));
    assert.ok(result.includes('3'));
    assert.ok(result.includes('FARGATE'));
    assert.ok(result.includes('steady state'));
  });

  it('returns not-found message when services is empty', async () => {
    mockCli({ services: [] });
    const result = await toolModules.ecs_describe_service.execute({ cluster: 'c', service: 's' }, ctx());
    assert.ok(result.includes('not found'));
  });

  it('includes cluster and service in command', async () => {
    mockCli({ services: [] });
    await toolModules.ecs_describe_service.execute({ cluster: 'mycluster', service: 'mysvc' }, ctx());
    const cmd = lastCmd();
    assert.ok(cmd.includes('mycluster'));
    assert.ok(cmd.includes('mysvc'));
  });

  it('shows up to 5 recent events', async () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      createdAt: '2024-01-01', message: `event-${i}`
    }));
    mockCli({
      services: [{
        serviceName: 's', status: 'ACTIVE', runningCount: 1, desiredCount: 1,
        taskDefinition: 'td', launchType: 'EC2', events
      }]
    });
    const result = await toolModules.ecs_describe_service.execute({ cluster: 'c', service: 's' }, ctx());
    // Only first 5 events should appear (event-0 through event-4)
    assert.ok(result.includes('event-4'));
    assert.ok(!result.includes('event-5'));
  });
});

// ---------------------------------------------------------------------------
// lambda_list_functions
// ---------------------------------------------------------------------------
describe('lambda_list_functions', () => {
  it('returns formatted function list', async () => {
    mockCli({
      Functions: [
        { FunctionName: 'my-func', Runtime: 'nodejs20.x', MemorySize: 256, LastModified: '2024-01-01' }
      ]
    });
    const result = await toolModules.lambda_list_functions.execute({}, ctx());
    assert.ok(result.includes('my-func'));
    assert.ok(result.includes('nodejs20.x'));
    assert.ok(result.includes('256'));
  });

  it('returns no-functions message when empty', async () => {
    mockCli({ Functions: [] });
    const result = await toolModules.lambda_list_functions.execute({}, ctx());
    assert.ok(result.includes('No Lambda functions'));
  });

  it('calls lambda list-functions', async () => {
    mockCli({ Functions: [] });
    await toolModules.lambda_list_functions.execute({}, ctx());
    assert.ok(lastCmd().includes('lambda list-functions'));
  });
});

// ---------------------------------------------------------------------------
// lambda_get_function
// ---------------------------------------------------------------------------
describe('lambda_get_function', () => {
  it('returns raw parsed object from CLI', async () => {
    const fnConfig = { FunctionName: 'my-func', Runtime: 'nodejs20.x', Role: 'arn:aws:iam::123:role/exec' };
    mockCli(fnConfig);
    const result = await toolModules.lambda_get_function.execute({ functionName: 'my-func' }, ctx());
    assert.equal(result.FunctionName, 'my-func');
    assert.equal(result.Runtime, 'nodejs20.x');
  });

  it('includes functionName in command', async () => {
    mockCli({});
    await toolModules.lambda_get_function.execute({ functionName: 'target-func' }, ctx());
    assert.ok(lastCmd().includes('target-func'));
    assert.ok(lastCmd().includes('lambda get-function-configuration'));
  });
});

// ---------------------------------------------------------------------------
// lambda_invoke
// ---------------------------------------------------------------------------
describe('lambda_invoke', () => {
  it('returns parsed JSON response', async () => {
    mockCliRaw('{"statusCode": 200, "body": "ok"}');
    const result = await toolModules.lambda_invoke.execute({ functionName: 'my-func' }, ctx());
    assert.equal(typeof result, 'object');
    assert.equal(result.statusCode, 200);
  });

  it('returns raw string for non-JSON response', async () => {
    mockCliRaw('plain text response');
    const result = await toolModules.lambda_invoke.execute({ functionName: 'my-func' }, ctx());
    assert.equal(typeof result, 'string');
    assert.equal(result, 'plain text response');
  });

  it('includes payload in command when provided', async () => {
    mockCliRaw('{}');
    await toolModules.lambda_invoke.execute({ functionName: 'f', payload: '{"key":"val"}' }, ctx());
    assert.ok(lastCmd().includes('--payload'));
  });

  it('omits --payload when not provided', async () => {
    mockCliRaw('{}');
    await toolModules.lambda_invoke.execute({ functionName: 'f' }, ctx());
    assert.ok(!lastCmd().includes('--payload'));
  });

  it('includes /dev/stdout in command', async () => {
    mockCliRaw('{}');
    await toolModules.lambda_invoke.execute({ functionName: 'f' }, ctx());
    assert.ok(lastCmd().includes('/dev/stdout'));
  });
});

// ---------------------------------------------------------------------------
// logs_list_groups
// ---------------------------------------------------------------------------
describe('logs_list_groups', () => {
  it('returns formatted log group list', async () => {
    mockCli({
      logGroups: [{ logGroupName: '/aws/lambda/my-func', storedBytes: 1048576 }]
    });
    const result = await toolModules.logs_list_groups.execute({}, ctx());
    assert.ok(result.includes('/aws/lambda/my-func'));
    assert.ok(result.includes('1.0MB'));
  });

  it('returns no-groups message when empty', async () => {
    mockCli({ logGroups: [] });
    const result = await toolModules.logs_list_groups.execute({}, ctx());
    assert.ok(result.includes('No log groups'));
  });

  it('uses default limit of 50', async () => {
    mockCli({ logGroups: [] });
    await toolModules.logs_list_groups.execute({}, ctx());
    assert.ok(lastCmd().includes('--limit 50'));
  });

  it('respects custom limit', async () => {
    mockCli({ logGroups: [] });
    await toolModules.logs_list_groups.execute({ limit: 20 }, ctx());
    assert.ok(lastCmd().includes('--limit 20'));
  });

  it('caps limit at 50', async () => {
    mockCli({ logGroups: [] });
    await toolModules.logs_list_groups.execute({ limit: 200 }, ctx());
    assert.ok(lastCmd().includes('--limit 50'));
  });

  it('shows n/a for null storedBytes', async () => {
    mockCli({ logGroups: [{ logGroupName: '/test', storedBytes: null }] });
    const result = await toolModules.logs_list_groups.execute({}, ctx());
    assert.ok(result.includes('n/a'));
  });
});

// ---------------------------------------------------------------------------
// logs_tail
// ---------------------------------------------------------------------------
describe('logs_tail', () => {
  it('returns formatted log events', async () => {
    mockCli({
      events: [{ timestamp: 1704067200000, message: 'Hello World' }]
    });
    const result = await toolModules.logs_tail.execute({ logGroup: '/aws/lambda/f' }, ctx());
    assert.ok(result.includes('Hello World'));
    assert.ok(result.includes('2024-'));
  });

  it('returns no-events message when empty', async () => {
    mockCli({ events: [] });
    const result = await toolModules.logs_tail.execute({ logGroup: '/test' }, ctx());
    assert.ok(result.includes('No recent'));
  });

  it('uses default limit of 20', async () => {
    mockCli({ events: [] });
    await toolModules.logs_tail.execute({ logGroup: '/test' }, ctx());
    assert.ok(lastCmd().includes('--limit 20'));
  });

  it('caps limit at 100', async () => {
    mockCli({ events: [] });
    await toolModules.logs_tail.execute({ logGroup: '/test', limit: 500 }, ctx());
    assert.ok(lastCmd().includes('--limit 100'));
  });

  it('includes log group name in command', async () => {
    mockCli({ events: [] });
    await toolModules.logs_tail.execute({ logGroup: '/aws/lambda/myfunc' }, ctx());
    assert.ok(lastCmd().includes('/aws/lambda/myfunc'));
  });

  it('trims message whitespace', async () => {
    mockCli({
      events: [{ timestamp: 1704067200000, message: '  padded   \n' }]
    });
    const result = await toolModules.logs_tail.execute({ logGroup: '/t' }, ctx());
    assert.ok(result.includes('padded'));
    assert.ok(!result.includes('  padded'));
  });
});

// ---------------------------------------------------------------------------
// s3_list_buckets
// ---------------------------------------------------------------------------
describe('s3_list_buckets', () => {
  it('returns formatted bucket list', async () => {
    mockCli({ Buckets: [{ Name: 'my-bucket', CreationDate: '2024-01-01' }] });
    const result = await toolModules.s3_list_buckets.execute({}, ctx());
    assert.ok(result.includes('my-bucket'));
    assert.ok(result.includes('2024-01-01'));
  });

  it('returns no-buckets message when empty', async () => {
    mockCli({ Buckets: [] });
    const result = await toolModules.s3_list_buckets.execute({}, ctx());
    assert.ok(result.includes('No buckets'));
  });

  it('calls s3api list-buckets', async () => {
    mockCli({ Buckets: [] });
    await toolModules.s3_list_buckets.execute({}, ctx());
    assert.ok(lastCmd().includes('s3api list-buckets'));
  });
});

// ---------------------------------------------------------------------------
// s3_list_objects
// ---------------------------------------------------------------------------
describe('s3_list_objects', () => {
  it('returns formatted object list', async () => {
    mockCli({
      Contents: [{ Key: 'foo/bar.txt', Size: 1024, LastModified: '2024-01-01' }]
    });
    const result = await toolModules.s3_list_objects.execute({ bucket: 'my-bucket' }, ctx());
    assert.ok(result.includes('foo/bar.txt'));
  });

  it('returns no-objects message when empty', async () => {
    mockCli({});
    const result = await toolModules.s3_list_objects.execute({ bucket: 'empty' }, ctx());
    assert.ok(result.includes('No objects'));
  });

  it('includes bucket name in command', async () => {
    mockCli({ Contents: [] });
    await toolModules.s3_list_objects.execute({ bucket: 'target-bucket' }, ctx());
    assert.ok(lastCmd().includes('target-bucket'));
    assert.ok(lastCmd().includes('s3api list-objects-v2'));
  });

  it('adds prefix to command when provided', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b', prefix: 'logs/' }, ctx());
    assert.ok(lastCmd().includes('--prefix'));
    assert.ok(lastCmd().includes('logs/'));
  });

  it('omits prefix when not provided', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b' }, ctx());
    assert.ok(!lastCmd().includes('--prefix'));
  });

  it('uses default limit of 20', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b' }, ctx());
    assert.ok(lastCmd().includes('--max-keys 20'));
  });

  it('caps limit at 1000', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b', limit: 9999 }, ctx());
    assert.ok(lastCmd().includes('--max-keys 1000'));
  });

  it('sanitizes shell injection characters from bucket name', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b; rm -rf /' }, ctx());
    assert.ok(!lastCmd().includes(';'));
  });
});

// ---------------------------------------------------------------------------
// s3_get_object
// ---------------------------------------------------------------------------
describe('s3_get_object', () => {
  it('returns object content', async () => {
    mockCliRaw('file contents here');
    const result = await toolModules.s3_get_object.execute({ bucket: 'b', key: 'file.txt' }, ctx());
    assert.equal(result, 'file contents here');
  });

  it('constructs s3:// URL in command', async () => {
    mockCliRaw('');
    await toolModules.s3_get_object.execute({ bucket: 'my-bucket', key: 'path/to/file' }, ctx());
    assert.ok(lastCmd().includes('s3://my-bucket/path/to/file'));
  });

  it('propagates CLI error', async () => {
    mockCliError('NoSuchKey');
    await assert.rejects(() => toolModules.s3_get_object.execute({ bucket: 'b', key: 'bad' }, ctx()), /NoSuchKey/);
  });
});

// ---------------------------------------------------------------------------
// sqs_list_queues
// ---------------------------------------------------------------------------
describe('sqs_list_queues', () => {
  it('returns queue names and URLs', async () => {
    mockCli({ QueueUrls: ['https://sqs.us-east-1.amazonaws.com/123/my-queue'] });
    const result = await toolModules.sqs_list_queues.execute({}, ctx());
    assert.ok(result.includes('my-queue'));
    assert.ok(result.includes('https://sqs'));
  });

  it('returns no-queues message when empty', async () => {
    mockCli({ QueueUrls: [] });
    const result = await toolModules.sqs_list_queues.execute({}, ctx());
    assert.ok(result.includes('No SQS queues'));
  });

  it('calls sqs list-queues', async () => {
    mockCli({ QueueUrls: [] });
    await toolModules.sqs_list_queues.execute({}, ctx());
    assert.ok(lastCmd().includes('sqs list-queues'));
  });
});

// ---------------------------------------------------------------------------
// sqs_get_queue_attributes
// ---------------------------------------------------------------------------
describe('sqs_get_queue_attributes', () => {
  it('returns formatted queue attributes', async () => {
    mockCli({
      Attributes: {
        ApproximateNumberOfMessages: '5',
        ApproximateNumberOfMessagesNotVisible: '2',
        ApproximateNumberOfMessagesDelayed: '0',
        MessageRetentionPeriod: '345600',
        VisibilityTimeout: '30',
        CreatedTimestamp: '1704067200'
      }
    });
    const result = await toolModules.sqs_get_queue_attributes.execute({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/my-queue'
    }, ctx());
    assert.ok(result.includes('my-queue'));
    assert.ok(result.includes('5'));
    assert.ok(result.includes('4 days'));
    assert.ok(result.includes('30'));
  });

  it('shows 0 for missing counts', async () => {
    mockCli({ Attributes: { CreatedTimestamp: '0' } });
    const result = await toolModules.sqs_get_queue_attributes.execute({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/q'
    }, ctx());
    assert.ok(result.includes('0'));
  });

  it('includes queue URL in command', async () => {
    mockCli({ Attributes: {} });
    await toolModules.sqs_get_queue_attributes.execute({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/target-q'
    }, ctx());
    assert.ok(lastCmd().includes('sqs get-queue-attributes'));
  });

  it('includes region in all CLI commands', async () => {
    mockCli({ Account: '1', Arn: 'a', UserId: 'u' });
    await toolModules.whoami.execute({}, ctx('ap-southeast-1'));
    assert.ok(lastCmd().includes('--region ap-southeast-1'));
  });
});

// ---------------------------------------------------------------------------
// sanitize (via s3_list_objects with injection attempts)
// ---------------------------------------------------------------------------
describe('input sanitization', () => {
  it('strips backticks from bucket name', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b`whoami`' }, ctx());
    assert.ok(!lastCmd().includes('`'));
  });

  it('strips dollar signs from bucket name', async () => {
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'b$(id)' }, ctx());
    assert.ok(!lastCmd().includes('$'));
  });

  it('strips pipe from cluster name', async () => {
    mockCli({ serviceArns: [] });
    await toolModules.ecs_list_services.execute({ cluster: 'prod | cat /etc/passwd' }, ctx());
    assert.ok(!lastCmd().includes('|'));
  });

  it('preserves dots and hyphens in bucket name', async () => {
    mockCli({ Buckets: [] });
    await toolModules.s3_list_buckets.execute({}, ctx());
    // Ensure sanitize allows legit bucket chars elsewhere — check s3_list_objects
    mockCli({});
    await toolModules.s3_list_objects.execute({ bucket: 'my.dotted-bucket' }, ctx());
    assert.ok(lastCmd().includes('my.dotted-bucket'));
  });

  it('preserves forward slashes in S3 key', async () => {
    mockCliRaw('data');
    await toolModules.s3_get_object.execute({ bucket: 'b', key: 'path/to/deep/file.txt' }, ctx());
    assert.ok(lastCmd().includes('path/to/deep/file.txt'));
  });

  it('preserves ARN format in function name', async () => {
    mockCli({});
    await toolModules.lambda_get_function.execute({
      functionName: 'arn:aws:lambda:us-east-1:123456789:function:my-func'
    }, ctx());
    assert.ok(lastCmd().includes('arn:aws:lambda:us-east-1:123456789:function:my-func'));
  });
});
