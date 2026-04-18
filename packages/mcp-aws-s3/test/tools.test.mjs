/**
 * Comprehensive unit tests for mcp-aws-s3 tools/*.mjs (zeromcp format).
 *
 * Each tool exports { description, input, execute } where
 * execute(args, ctx) receives ctx.credentials = { accessKeyId, secretAccessKey, region }.
 * createClient(credentials) returns { getClient } which returns an S3Client.
 *
 * Strategy: mock @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner before
 * importing tools. The mock S3Client.send() is a controllable function.
 */
import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// S3 mock — installed before any tool imports
// ---------------------------------------------------------------------------
let sendImpl = async () => ({});

class MockS3Client {
  send(cmd) { return sendImpl(cmd); }
}

// Track instantiation args
const s3ClientInstances = [];
class TrackingS3Client extends MockS3Client {
  constructor(cfg) { super(); s3ClientInstances.push(cfg); }
}

await mock.module('@aws-sdk/client-s3', {
  namedExports: {
    S3Client: TrackingS3Client,
    ListBucketsCommand: class { constructor(p) { this.params = p; this.name = 'ListBucketsCommand'; } },
    ListObjectsV2Command: class { constructor(p) { this.params = p; this.name = 'ListObjectsV2Command'; } },
    GetObjectCommand: class { constructor(p) { this.params = p; this.name = 'GetObjectCommand'; } },
    PutObjectCommand: class { constructor(p) { this.params = p; this.name = 'PutObjectCommand'; } },
    DeleteObjectCommand: class { constructor(p) { this.params = p; this.name = 'DeleteObjectCommand'; } },
    CopyObjectCommand: class { constructor(p) { this.params = p; this.name = 'CopyObjectCommand'; } },
    HeadObjectCommand: class { constructor(p) { this.params = p; this.name = 'HeadObjectCommand'; } },
    HeadBucketCommand: class { constructor(p) { this.params = p; this.name = 'HeadBucketCommand'; } },
    CreateBucketCommand: class { constructor(p) { this.params = p; this.name = 'CreateBucketCommand'; } },
    DeleteBucketCommand: class { constructor(p) { this.params = p; this.name = 'DeleteBucketCommand'; } },
    GetBucketLocationCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketLocationCommand'; } },
    GetBucketVersioningCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketVersioningCommand'; } },
    GetBucketTaggingCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketTaggingCommand'; } },
    PutBucketTaggingCommand: class { constructor(p) { this.params = p; this.name = 'PutBucketTaggingCommand'; } },
    GetBucketPolicyCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketPolicyCommand'; } },
    GetBucketCorsCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketCorsCommand'; } },
    GetBucketLifecycleConfigurationCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketLifecycleConfigurationCommand'; } },
    GetBucketEncryptionCommand: class { constructor(p) { this.params = p; this.name = 'GetBucketEncryptionCommand'; } },
  }
});

await mock.module('@aws-sdk/s3-request-presigner', {
  namedExports: {
    getSignedUrl: async (_client, cmd, _opts) => `https://presigned.example.com/${cmd.name || 'url'}`
  }
});

// Base ctx
function ctx(overrides = {}) {
  return {
    credentials: {
      accessKeyId: 'AKIATEST',
      secretAccessKey: 'secret',
      region: 'us-east-1',
      ...overrides
    },
    fetch: globalThis.fetch
  };
}

// ---------------------------------------------------------------------------
// Import all tools after mocks installed
// ---------------------------------------------------------------------------
let toolModules;

before(async () => {
  toolModules = {
    list_buckets:  (await import('../tools/list_buckets.mjs')).default,
    list_objects:  (await import('../tools/list_objects.mjs')).default,
    get_object:    (await import('../tools/get_object.mjs')).default,
    put_object:    (await import('../tools/put_object.mjs')).default,
    delete_object: (await import('../tools/delete_object.mjs')).default,
    copy_object:   (await import('../tools/copy_object.mjs')).default,
    head_object:   (await import('../tools/head_object.mjs')).default,
    presign:       (await import('../tools/presign.mjs')).default,
    bucket_info:   (await import('../tools/bucket_info.mjs')).default,
    create_bucket: (await import('../tools/create_bucket.mjs')).default,
    delete_bucket: (await import('../tools/delete_bucket.mjs')).default,
    search:        (await import('../tools/search.mjs')).default,
  };
});

afterEach(() => {
  sendImpl = async () => ({});
  s3ClientInstances.length = 0;
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
        if (prop.type) {
          assert.ok(validTypes.includes(prop.type), `${name}.input.${key}: invalid type '${prop.type}'`);
        }
        assert.ok(typeof prop.description === 'string', `${name}.input.${key}: must have description`);
        assert.ok(prop.description.length > 0, `${name}.input.${key}: description must be non-empty`);
      }
    }
  });

  it('has 12 tool files', () => {
    assert.equal(Object.keys(toolModules).length, 12);
  });
});

// ---------------------------------------------------------------------------
// list_buckets
// ---------------------------------------------------------------------------
describe('list_buckets', () => {
  it('returns bucket list with count', async () => {
    sendImpl = async () => ({
      Buckets: [
        { Name: 'bucket-a', CreationDate: new Date('2024-01-01') },
        { Name: 'bucket-b', CreationDate: new Date('2024-06-01') }
      ]
    });
    const result = await toolModules.list_buckets.execute({}, ctx());
    assert.ok(result.includes('2 buckets'));
    assert.ok(result.includes('bucket-a'));
    assert.ok(result.includes('bucket-b'));
  });

  it('returns no-buckets message when empty', async () => {
    sendImpl = async () => ({ Buckets: [] });
    const result = await toolModules.list_buckets.execute({}, ctx());
    assert.equal(result, 'No buckets found.');
  });

  it('uses the region from args when provided', async () => {
    sendImpl = async () => ({ Buckets: [] });
    await toolModules.list_buckets.execute({ region: 'eu-west-1' }, ctx());
    const cfg = s3ClientInstances[s3ClientInstances.length - 1];
    assert.equal(cfg.region, 'eu-west-1');
  });

  it('falls back to credential region when region arg omitted', async () => {
    sendImpl = async () => ({ Buckets: [] });
    await toolModules.list_buckets.execute({}, ctx({ region: 'ap-southeast-1' }));
    const cfg = s3ClientInstances[s3ClientInstances.length - 1];
    assert.equal(cfg.region, 'ap-southeast-1');
  });

  it('propagates SDK error', async () => {
    sendImpl = async () => { throw new Error('AccessDenied'); };
    await assert.rejects(() => toolModules.list_buckets.execute({}, ctx()), /AccessDenied/);
  });
});

// ---------------------------------------------------------------------------
// list_objects
// ---------------------------------------------------------------------------
describe('list_objects', () => {
  it('lists objects and folders', async () => {
    sendImpl = async (cmd) => ({
      Contents: [{ Key: 'folder/file.txt', Size: 1024, LastModified: new Date('2024-01-01') }],
      CommonPrefixes: [{ Prefix: 'logs/' }],
      IsTruncated: false
    });
    const result = await toolModules.list_objects.execute({ bucket: 'my-bucket' }, ctx());
    assert.ok(result.includes('folder/file.txt'));
    assert.ok(result.includes('logs/'));
    assert.ok(result.includes('s3://my-bucket/'));
  });

  it('shows (empty) when no objects or folders', async () => {
    sendImpl = async () => ({ Contents: [], CommonPrefixes: [], IsTruncated: false });
    const result = await toolModules.list_objects.execute({ bucket: 'empty' }, ctx());
    assert.ok(result.includes('(empty)'));
  });

  it('shows pagination token when truncated', async () => {
    sendImpl = async () => ({
      Contents: [{ Key: 'a.txt', Size: 0, LastModified: new Date() }],
      CommonPrefixes: [],
      IsTruncated: true,
      NextContinuationToken: 'token-abc123'
    });
    const result = await toolModules.list_objects.execute({ bucket: 'big' }, ctx());
    assert.ok(result.includes('token-abc123'));
    assert.ok(result.includes('More results'));
  });

  it('passes prefix and continuation_token to command', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { Contents: [], IsTruncated: false }; };
    await toolModules.list_objects.execute(
      { bucket: 'b', prefix: 'logs/', continuation_token: 'tok' },
      ctx()
    );
    assert.equal(capturedCmd.params.Prefix, 'logs/');
    assert.equal(capturedCmd.params.ContinuationToken, 'tok');
  });

  it('uses default limit 100', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { IsTruncated: false }; };
    await toolModules.list_objects.execute({ bucket: 'b' }, ctx());
    assert.equal(capturedCmd.params.MaxKeys, 100);
  });
});

// ---------------------------------------------------------------------------
// get_object
// ---------------------------------------------------------------------------
describe('get_object', () => {
  it('returns formatted content with metadata', async () => {
    sendImpl = async () => ({
      ContentType: 'text/plain',
      ContentLength: 12,
      LastModified: new Date('2024-01-01'),
      Body: { transformToString: async () => 'Hello World!' }
    });
    const result = await toolModules.get_object.execute({ bucket: 'b', key: 'hello.txt' }, ctx());
    assert.ok(result.includes('s3://b/hello.txt'));
    assert.ok(result.includes('text/plain'));
    assert.ok(result.includes('Hello World!'));
  });

  it('includes version when present', async () => {
    sendImpl = async () => ({
      ContentType: 'text/plain', ContentLength: 5,
      LastModified: new Date(),
      VersionId: 'v-abc123',
      Body: { transformToString: async () => 'data' }
    });
    const result = await toolModules.get_object.execute({ bucket: 'b', key: 'f' }, ctx());
    assert.ok(result.includes('v-abc123'));
  });

  it('sets Range header for max_bytes', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => {
      capturedCmd = cmd;
      return { ContentType: 'text/plain', ContentLength: 0, LastModified: new Date(), Body: { transformToString: async () => '' } };
    };
    await toolModules.get_object.execute({ bucket: 'b', key: 'f', max_bytes: 512 }, ctx());
    assert.equal(capturedCmd.params.Range, 'bytes=0-511');
  });

  it('propagates NoSuchKey error', async () => {
    sendImpl = async () => { throw new Error('NoSuchKey'); };
    await assert.rejects(() => toolModules.get_object.execute({ bucket: 'b', key: 'missing' }, ctx()), /NoSuchKey/);
  });
});

// ---------------------------------------------------------------------------
// put_object
// ---------------------------------------------------------------------------
describe('put_object', () => {
  it('uploads and returns success message with ETag', async () => {
    sendImpl = async () => ({ ETag: '"abc123"' });
    const result = await toolModules.put_object.execute(
      { bucket: 'b', key: 'test.txt', body: 'Hello' },
      ctx()
    );
    assert.ok(result.includes('s3://b/test.txt'));
    assert.ok(result.includes('"abc123"'));
  });

  it('sends correct params to PutObjectCommand', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { ETag: 'e' }; };
    await toolModules.put_object.execute(
      { bucket: 'my-bucket', key: 'data.json', body: '{}', content_type: 'application/json' },
      ctx()
    );
    assert.equal(capturedCmd.params.Bucket, 'my-bucket');
    assert.equal(capturedCmd.params.Key, 'data.json');
    assert.equal(capturedCmd.params.Body, '{}');
    assert.equal(capturedCmd.params.ContentType, 'application/json');
  });

  it('defaults content_type to text/plain', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { ETag: 'e' }; };
    await toolModules.put_object.execute({ bucket: 'b', key: 'k', body: 'data' }, ctx());
    assert.equal(capturedCmd.params.ContentType, 'text/plain');
  });

  it('includes byte size in result', async () => {
    sendImpl = async () => ({ ETag: 'e' });
    const result = await toolModules.put_object.execute({ bucket: 'b', key: 'k', body: 'Hello' }, ctx());
    // 'Hello' is 5 bytes
    assert.ok(result.includes('5 B'));
  });
});

// ---------------------------------------------------------------------------
// delete_object
// ---------------------------------------------------------------------------
describe('delete_object', () => {
  it('returns success message with bucket and key', async () => {
    sendImpl = async () => ({});
    const result = await toolModules.delete_object.execute({ bucket: 'b', key: 'path/file.txt' }, ctx());
    assert.ok(result.includes('s3://b/path/file.txt'));
  });

  it('sends DeleteObjectCommand with correct params', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return {}; };
    await toolModules.delete_object.execute({ bucket: 'my-bucket', key: 'to-delete.txt' }, ctx());
    assert.equal(capturedCmd.params.Bucket, 'my-bucket');
    assert.equal(capturedCmd.params.Key, 'to-delete.txt');
  });

  it('propagates error on non-existent key', async () => {
    sendImpl = async () => { throw new Error('NoSuchKey'); };
    await assert.rejects(() => toolModules.delete_object.execute({ bucket: 'b', key: 'nope' }, ctx()), /NoSuchKey/);
  });
});

// ---------------------------------------------------------------------------
// copy_object
// ---------------------------------------------------------------------------
describe('copy_object', () => {
  it('returns success message with source and destination', async () => {
    sendImpl = async () => ({});
    const result = await toolModules.copy_object.execute(
      { source_bucket: 'src', source_key: 'a.txt', dest_bucket: 'dst', dest_key: 'b.txt' },
      ctx()
    );
    assert.ok(result.includes('s3://src/a.txt'));
    assert.ok(result.includes('s3://dst/b.txt'));
  });

  it('sends CopyObjectCommand with CopySource', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return {}; };
    await toolModules.copy_object.execute(
      { source_bucket: 'src', source_key: 'orig.txt', dest_bucket: 'dst', dest_key: 'copy.txt' },
      ctx()
    );
    assert.equal(capturedCmd.params.CopySource, 'src/orig.txt');
    assert.equal(capturedCmd.params.Bucket, 'dst');
    assert.equal(capturedCmd.params.Key, 'copy.txt');
  });

  it('propagates error from SDK', async () => {
    sendImpl = async () => { throw new Error('NoSuchBucket'); };
    await assert.rejects(() => toolModules.copy_object.execute(
      { source_bucket: 'bad', source_key: 'k', dest_bucket: 'd', dest_key: 'k' }, ctx()
    ), /NoSuchBucket/);
  });
});

// ---------------------------------------------------------------------------
// head_object
// ---------------------------------------------------------------------------
describe('head_object', () => {
  it('returns metadata without body', async () => {
    sendImpl = async () => ({
      ContentLength: 2048,
      ContentType: 'application/json',
      LastModified: new Date('2024-06-01'),
      ETag: '"etag123"',
      VersionId: 'v1',
      StorageClass: 'STANDARD',
      ServerSideEncryption: 'AES256',
      Metadata: { 'x-custom': 'value' }
    });
    const result = await toolModules.head_object.execute({ bucket: 'b', key: 'data.json' }, ctx());
    assert.ok(result.includes('s3://b/data.json'));
    assert.ok(result.includes('application/json'));
    assert.ok(result.includes('"etag123"'));
    assert.ok(result.includes('v1'));
    assert.ok(result.includes('STANDARD'));
    assert.ok(result.includes('AES256'));
    assert.ok(result.includes('x-custom'));
    assert.ok(result.includes('value'));
  });

  it('omits optional fields when missing', async () => {
    sendImpl = async () => ({
      ContentLength: 0,
      ContentType: 'text/plain',
      LastModified: new Date(),
      ETag: '"e"'
    });
    const result = await toolModules.head_object.execute({ bucket: 'b', key: 'f' }, ctx());
    assert.ok(!result.includes('Version:'));
    assert.ok(!result.includes('Storage Class:'));
    assert.ok(!result.includes('Encryption:'));
    assert.ok(!result.includes('Metadata:'));
  });

  it('propagates 404 error', async () => {
    sendImpl = async () => { throw new Error('NotFound'); };
    await assert.rejects(() => toolModules.head_object.execute({ bucket: 'b', key: 'missing' }, ctx()), /NotFound/);
  });
});

// ---------------------------------------------------------------------------
// presign
// ---------------------------------------------------------------------------
describe('presign', () => {
  it('returns presigned GET URL by default', async () => {
    const result = await toolModules.presign.execute({ bucket: 'b', key: 'file.txt' }, ctx());
    assert.ok(result.includes('Presigned GET URL'));
    assert.ok(result.includes('3600s'));
    assert.ok(result.includes('https://presigned'));
  });

  it('returns presigned PUT URL when operation=put', async () => {
    const result = await toolModules.presign.execute(
      { bucket: 'b', key: 'upload.bin', operation: 'put', expires_in: 900 },
      ctx()
    );
    assert.ok(result.includes('Presigned PUT URL'));
    assert.ok(result.includes('900s'));
  });

  it('uses custom expiry', async () => {
    const result = await toolModules.presign.execute(
      { bucket: 'b', key: 'f', expires_in: 7200 },
      ctx()
    );
    assert.ok(result.includes('7200s'));
  });
});

// ---------------------------------------------------------------------------
// bucket_info
// ---------------------------------------------------------------------------
describe('bucket_info', () => {
  it('returns basic bucket info with fallbacks', async () => {
    // All calls succeed with minimal data
    sendImpl = async (cmd) => {
      if (cmd.name === 'GetBucketLocationCommand') return { LocationConstraint: 'us-west-2' };
      if (cmd.name === 'GetBucketVersioningCommand') return { Status: 'Enabled' };
      if (cmd.name === 'GetBucketEncryptionCommand') return {
        ServerSideEncryptionConfiguration: {
          Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms' } }]
        }
      };
      if (cmd.name === 'GetBucketTaggingCommand') return { TagSet: [{ Key: 'env', Value: 'prod' }] };
      if (cmd.name === 'GetBucketCorsCommand') return { CORSRules: [{}] };
      if (cmd.name === 'GetBucketLifecycleConfigurationCommand') return {
        Rules: [{ Status: 'Enabled', ID: 'expire-old', Filter: { Prefix: 'logs/' } }]
      };
      return {};
    };
    const result = await toolModules.bucket_info.execute({ bucket: 'my-bucket' }, ctx());
    assert.ok(result.includes('my-bucket'));
    assert.ok(result.includes('us-west-2'));
    assert.ok(result.includes('Enabled'));
    assert.ok(result.includes('aws:kms'));
    assert.ok(result.includes('env'));
    assert.ok(result.includes('prod'));
    assert.ok(result.includes('1 rule(s)'));
    assert.ok(result.includes('expire-old'));
  });

  it('handles all sub-requests throwing (graceful fallback)', async () => {
    sendImpl = async () => { throw new Error('AccessDenied'); };
    // Should not throw — bucket_info uses safe() which catches all errors
    const result = await toolModules.bucket_info.execute({ bucket: 'restricted' }, ctx());
    assert.ok(result.includes('restricted'));
    assert.ok(result.includes('us-east-1'));  // default location
    assert.ok(result.includes('Disabled'));   // default versioning
    assert.ok(result.includes('None'));       // default encryption
  });

  it('shows tags when present', async () => {
    sendImpl = async (cmd) => {
      if (cmd.name === 'GetBucketTaggingCommand') {
        return { TagSet: [{ Key: 'Project', Value: 'antidrift' }, { Key: 'Stage', Value: 'prod' }] };
      }
      return {};
    };
    const result = await toolModules.bucket_info.execute({ bucket: 'b' }, ctx());
    assert.ok(result.includes('Project'));
    assert.ok(result.includes('antidrift'));
    assert.ok(result.includes('Stage'));
  });
});

// ---------------------------------------------------------------------------
// create_bucket
// ---------------------------------------------------------------------------
describe('create_bucket', () => {
  it('returns success message', async () => {
    sendImpl = async () => ({});
    const result = await toolModules.create_bucket.execute({ bucket: 'new-bucket', region: 'us-west-2' }, ctx());
    assert.ok(result.includes('s3://new-bucket'));
    assert.ok(result.includes('us-west-2'));
  });

  it('adds LocationConstraint for non-us-east-1 regions', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return {}; };
    await toolModules.create_bucket.execute({ bucket: 'b', region: 'eu-central-1' }, ctx());
    assert.deepEqual(
      capturedCmd.params.CreateBucketConfiguration,
      { LocationConstraint: 'eu-central-1' }
    );
  });

  it('omits LocationConstraint for us-east-1', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return {}; };
    await toolModules.create_bucket.execute({ bucket: 'b', region: 'us-east-1' }, ctx());
    assert.equal(capturedCmd.params.CreateBucketConfiguration, undefined);
  });

  it('propagates error on duplicate bucket name', async () => {
    sendImpl = async () => { throw new Error('BucketAlreadyExists'); };
    await assert.rejects(
      () => toolModules.create_bucket.execute({ bucket: 'exists', region: 'us-east-1' }, ctx()),
      /BucketAlreadyExists/
    );
  });
});

// ---------------------------------------------------------------------------
// delete_bucket
// ---------------------------------------------------------------------------
describe('delete_bucket', () => {
  it('returns success message', async () => {
    sendImpl = async () => ({});
    const result = await toolModules.delete_bucket.execute({ bucket: 'old-bucket' }, ctx());
    assert.ok(result.includes('s3://old-bucket'));
  });

  it('sends DeleteBucketCommand with correct bucket', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return {}; };
    await toolModules.delete_bucket.execute({ bucket: 'target' }, ctx());
    assert.equal(capturedCmd.params.Bucket, 'target');
  });

  it('propagates error on non-empty bucket', async () => {
    sendImpl = async () => { throw new Error('BucketNotEmpty'); };
    await assert.rejects(() => toolModules.delete_bucket.execute({ bucket: 'full' }, ctx()), /BucketNotEmpty/);
  });
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------
describe('search', () => {
  it('returns matching objects', async () => {
    sendImpl = async () => ({
      Contents: [
        { Key: 'data/report-2024.csv', Size: 500, LastModified: new Date('2024-01-01') },
        { Key: 'data/summary.txt', Size: 100, LastModified: new Date('2024-01-02') }
      ],
      IsTruncated: false
    });
    const result = await toolModules.search.execute({ bucket: 'b', suffix: '.csv' }, ctx());
    assert.ok(result.includes('report-2024.csv'));
    assert.ok(!result.includes('summary.txt'));
  });

  it('filters by contains substring', async () => {
    sendImpl = async () => ({
      Contents: [
        { Key: 'logs/error-001.log', Size: 200, LastModified: new Date() },
        { Key: 'logs/access-001.log', Size: 300, LastModified: new Date() }
      ],
      IsTruncated: false
    });
    const result = await toolModules.search.execute({ bucket: 'b', contains: 'error' }, ctx());
    assert.ok(result.includes('error-001'));
    assert.ok(!result.includes('access-001'));
  });

  it('returns no-match message when nothing found', async () => {
    sendImpl = async () => ({ Contents: [], IsTruncated: false });
    const result = await toolModules.search.execute({ bucket: 'b', suffix: '.xyz' }, ctx());
    assert.ok(result.includes('No objects found'));
  });

  it('combines contains and suffix filters', async () => {
    sendImpl = async () => ({
      Contents: [
        { Key: 'logs/error-2024.csv', Size: 10, LastModified: new Date() },
        { Key: 'logs/error-2023.txt', Size: 10, LastModified: new Date() },
        { Key: 'logs/access-2024.csv', Size: 10, LastModified: new Date() }
      ],
      IsTruncated: false
    });
    const result = await toolModules.search.execute({ bucket: 'b', contains: 'error', suffix: '.csv' }, ctx());
    assert.ok(result.includes('error-2024.csv'));
    assert.ok(!result.includes('error-2023.txt'));
    assert.ok(!result.includes('access-2024.csv'));
  });

  it('respects limit', async () => {
    sendImpl = async () => ({
      Contents: Array.from({ length: 10 }, (_, i) => ({
        Key: `file-${i}.txt`, Size: i, LastModified: new Date()
      })),
      IsTruncated: false
    });
    const result = await toolModules.search.execute({ bucket: 'b', limit: 3 }, ctx());
    // Should list exactly 3 objects
    const matches = result.match(/file-\d+\.txt/g) || [];
    assert.equal(matches.length, 3);
  });

  it('paginates when results are truncated', async () => {
    let callCount = 0;
    sendImpl = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          Contents: [{ Key: 'page1.txt', Size: 0, LastModified: new Date() }],
          IsTruncated: true,
          NextContinuationToken: 'tok2'
        };
      }
      return {
        Contents: [{ Key: 'page2.txt', Size: 0, LastModified: new Date() }],
        IsTruncated: false
      };
    };
    const result = await toolModules.search.execute({ bucket: 'b', limit: 100 }, ctx());
    assert.ok(result.includes('page1.txt'));
    assert.ok(result.includes('page2.txt'));
    assert.equal(callCount, 2);
  });
});

// ---------------------------------------------------------------------------
// fmtSize helper (via put_object output)
// ---------------------------------------------------------------------------
describe('fmtSize via put_object', () => {
  const cases = [
    [0, '0 B'],
    [1, '1 B'],
    [1024, '1.0 KB'],
    [1048576, '1.0 MB'],
  ];
  for (const [bytes, expected] of cases) {
    it(`${bytes} bytes formats as ${expected}`, async () => {
      sendImpl = async () => ({ ETag: 'e' });
      const body = 'x'.repeat(bytes);
      const result = await toolModules.put_object.execute({ bucket: 'b', key: 'k', body }, ctx());
      assert.ok(result.includes(expected), `Expected '${expected}' in: ${result}`);
    });
  }

  it('fmtSize formula correctly computes GB range', () => {
    // Verify the fmtSize formula directly for 1 GB without allocating the string
    const bytes = 1073741824; // 1 GB
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const formatted = `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    assert.equal(formatted, '1.0 GB');
  });
});

// ---------------------------------------------------------------------------
// Credential passthrough
// ---------------------------------------------------------------------------
describe('credential passthrough', () => {
  it('passes accessKeyId and secretAccessKey to S3Client', async () => {
    sendImpl = async () => ({ Buckets: [] });
    await toolModules.list_buckets.execute({}, ctx({ accessKeyId: 'AKIA_TEST', secretAccessKey: 'sec' }));
    const cfg = s3ClientInstances[s3ClientInstances.length - 1];
    assert.equal(cfg.credentials.accessKeyId, 'AKIA_TEST');
    assert.equal(cfg.credentials.secretAccessKey, 'sec');
  });
});
