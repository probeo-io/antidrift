import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  GetBucketLocationCommand,
  GetBucketVersioningCommand,
  GetBucketTaggingCommand,
  PutBucketTaggingCommand,
  GetBucketPolicyCommand,
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketEncryptionCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getClient(region) {
  return new S3Client(region ? { region } : {});
}

function fmtSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function fmtDate(d) {
  return d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '?';
}

export const tools = [
  {
    name: 's3_list_buckets',
    description: 'List all S3 buckets in the account.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region (optional)' }
      }
    },
    handler: async ({ region } = {}) => {
      const client = getClient(region);
      const res = await client.send(new ListBucketsCommand({}));
      const buckets = res.Buckets || [];
      if (!buckets.length) return 'No buckets found.';
      const lines = [`${buckets.length} buckets:\n`];
      for (const b of buckets) {
        lines.push(`  📦 ${b.Name}  created ${fmtDate(b.CreationDate)}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 's3_list_objects',
    description: 'List objects in an S3 bucket. Supports prefix filtering and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        prefix: { type: 'string', description: 'Key prefix to filter (e.g. "logs/2024/")' },
        delimiter: { type: 'string', description: 'Delimiter for folder-like listing (default "/")' },
        limit: { type: 'number', description: 'Max results (default 100)' },
        continuation_token: { type: 'string', description: 'Token for next page (from previous response)' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket']
    },
    handler: async ({ bucket, prefix, delimiter = '/', limit = 100, continuation_token, region }) => {
      const client = getClient(region);
      const params = { Bucket: bucket, MaxKeys: limit };
      if (prefix) params.Prefix = prefix;
      if (delimiter) params.Delimiter = delimiter;
      if (continuation_token) params.ContinuationToken = continuation_token;

      const res = await client.send(new ListObjectsV2Command(params));
      const lines = [`s3://${bucket}/${prefix || ''}\n`];

      const folders = res.CommonPrefixes || [];
      if (folders.length) {
        for (const f of folders) {
          lines.push(`  📁 ${f.Prefix}`);
        }
      }

      const objects = res.Contents || [];
      if (objects.length) {
        for (const o of objects) {
          lines.push(`  📄 ${o.Key}  ${fmtSize(o.Size)}  ${fmtDate(o.LastModified)}`);
        }
      }

      if (!folders.length && !objects.length) {
        lines.push('  (empty)');
      }

      lines.push(`\n  Showing ${objects.length} objects, ${folders.length} prefixes`);
      if (res.IsTruncated) {
        lines.push(`  More results available — continuation_token: ${res.NextContinuationToken}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 's3_get_object',
    description: 'Read an object from S3. Returns the content as text. For binary files, use s3_presign instead.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        key: { type: 'string', description: 'Object key' },
        region: { type: 'string', description: 'AWS region (optional)' },
        max_bytes: { type: 'number', description: 'Max bytes to read (default 1MB)' }
      },
      required: ['bucket', 'key']
    },
    handler: async ({ bucket, key, region, max_bytes = 1048576 }) => {
      const client = getClient(region);
      const params = { Bucket: bucket, Key: key };
      if (max_bytes) params.Range = `bytes=0-${max_bytes - 1}`;

      const res = await client.send(new GetObjectCommand(params));
      const body = await res.Body.transformToString();
      const lines = [`s3://${bucket}/${key}`];
      lines.push(`Content-Type: ${res.ContentType || '?'}  Size: ${fmtSize(res.ContentLength || 0)}  Modified: ${fmtDate(res.LastModified)}`);
      if (res.VersionId) lines.push(`Version: ${res.VersionId}`);
      lines.push('');
      lines.push(body);
      return lines.join('\n');
    }
  },
  {
    name: 's3_put_object',
    description: 'Upload text content to an S3 object. Creates or overwrites the object.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        key: { type: 'string', description: 'Object key' },
        body: { type: 'string', description: 'Content to upload' },
        content_type: { type: 'string', description: 'MIME type (default text/plain)' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket', 'key', 'body']
    },
    handler: async ({ bucket, key, body, content_type = 'text/plain', region }) => {
      const client = getClient(region);
      const res = await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body, ContentType: content_type
      }));
      return `✅ Uploaded s3://${bucket}/${key}  (${fmtSize(Buffer.byteLength(body))}, ETag: ${res.ETag})`;
    }
  },
  {
    name: 's3_delete_object',
    description: 'Delete an object from S3.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        key: { type: 'string', description: 'Object key' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket', 'key']
    },
    handler: async ({ bucket, key, region }) => {
      const client = getClient(region);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return `🗑️ Deleted s3://${bucket}/${key}`;
    }
  },
  {
    name: 's3_copy_object',
    description: 'Copy an object within or between S3 buckets.',
    inputSchema: {
      type: 'object',
      properties: {
        source_bucket: { type: 'string', description: 'Source bucket name' },
        source_key: { type: 'string', description: 'Source object key' },
        dest_bucket: { type: 'string', description: 'Destination bucket name' },
        dest_key: { type: 'string', description: 'Destination object key' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['source_bucket', 'source_key', 'dest_bucket', 'dest_key']
    },
    handler: async ({ source_bucket, source_key, dest_bucket, dest_key, region }) => {
      const client = getClient(region);
      await client.send(new CopyObjectCommand({
        Bucket: dest_bucket,
        Key: dest_key,
        CopySource: `${source_bucket}/${source_key}`
      }));
      return `✅ Copied s3://${source_bucket}/${source_key} → s3://${dest_bucket}/${dest_key}`;
    }
  },
  {
    name: 's3_head_object',
    description: 'Get metadata for an S3 object without downloading it.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        key: { type: 'string', description: 'Object key' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket', 'key']
    },
    handler: async ({ bucket, key, region }) => {
      const client = getClient(region);
      const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      const lines = [`s3://${bucket}/${key}\n`];
      lines.push(`  Size: ${fmtSize(res.ContentLength || 0)}`);
      lines.push(`  Content-Type: ${res.ContentType || '?'}`);
      lines.push(`  Last Modified: ${fmtDate(res.LastModified)}`);
      lines.push(`  ETag: ${res.ETag || '?'}`);
      if (res.VersionId) lines.push(`  Version: ${res.VersionId}`);
      if (res.StorageClass) lines.push(`  Storage Class: ${res.StorageClass}`);
      if (res.ServerSideEncryption) lines.push(`  Encryption: ${res.ServerSideEncryption}`);
      if (res.Metadata && Object.keys(res.Metadata).length) {
        lines.push('  Metadata:');
        for (const [k, v] of Object.entries(res.Metadata)) {
          lines.push(`    ${k}: ${v}`);
        }
      }
      return lines.join('\n');
    }
  },
  {
    name: 's3_presign',
    description: 'Generate a presigned URL for an S3 object (GET or PUT). Useful for sharing files or uploading binary content.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        key: { type: 'string', description: 'Object key' },
        operation: { type: 'string', description: 'get or put (default get)' },
        expires_in: { type: 'number', description: 'URL expiry in seconds (default 3600)' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket', 'key']
    },
    handler: async ({ bucket, key, operation = 'get', expires_in = 3600, region }) => {
      const client = getClient(region);
      const cmd = operation === 'put'
        ? new PutObjectCommand({ Bucket: bucket, Key: key })
        : new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(client, cmd, { expiresIn: expires_in });
      return `🔗 Presigned ${operation.toUpperCase()} URL (expires in ${expires_in}s):\n\n${url}`;
    }
  },
  {
    name: 's3_bucket_info',
    description: 'Get detailed info about a bucket — location, versioning, encryption, tags, lifecycle, CORS.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket']
    },
    handler: async ({ bucket, region }) => {
      const client = getClient(region);
      const lines = [`📦 ${bucket}\n`];

      const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

      const location = await safe(
        () => client.send(new GetBucketLocationCommand({ Bucket: bucket })),
        null
      );
      lines.push(`  Region: ${location?.LocationConstraint || 'us-east-1'}`);

      const versioning = await safe(
        () => client.send(new GetBucketVersioningCommand({ Bucket: bucket })),
        null
      );
      lines.push(`  Versioning: ${versioning?.Status || 'Disabled'}`);

      const encryption = await safe(
        () => client.send(new GetBucketEncryptionCommand({ Bucket: bucket })),
        null
      );
      if (encryption?.ServerSideEncryptionConfiguration?.Rules?.length) {
        const rule = encryption.ServerSideEncryptionConfiguration.Rules[0];
        const algo = rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm || '?';
        lines.push(`  Encryption: ${algo}`);
      } else {
        lines.push('  Encryption: None');
      }

      const tags = await safe(
        () => client.send(new GetBucketTaggingCommand({ Bucket: bucket })),
        null
      );
      if (tags?.TagSet?.length) {
        lines.push('  Tags:');
        for (const t of tags.TagSet) {
          lines.push(`    ${t.Key}: ${t.Value}`);
        }
      }

      const cors = await safe(
        () => client.send(new GetBucketCorsCommand({ Bucket: bucket })),
        null
      );
      if (cors?.CORSRules?.length) {
        lines.push(`  CORS: ${cors.CORSRules.length} rule(s)`);
      }

      const lifecycle = await safe(
        () => client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket })),
        null
      );
      if (lifecycle?.Rules?.length) {
        lines.push(`  Lifecycle: ${lifecycle.Rules.length} rule(s)`);
        for (const r of lifecycle.Rules) {
          lines.push(`    ${r.Status === 'Enabled' ? '🟢' : '🔴'} ${r.ID || '(unnamed)'}  prefix: ${r.Filter?.Prefix || r.Prefix || '*'}`);
        }
      }

      return lines.join('\n');
    }
  },
  {
    name: 's3_create_bucket',
    description: 'Create a new S3 bucket.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        region: { type: 'string', description: 'AWS region (e.g. us-east-1)' }
      },
      required: ['bucket', 'region']
    },
    handler: async ({ bucket, region }) => {
      const client = getClient(region);
      const params = { Bucket: bucket };
      if (region !== 'us-east-1') {
        params.CreateBucketConfiguration = { LocationConstraint: region };
      }
      await client.send(new CreateBucketCommand(params));
      return `✅ Created bucket s3://${bucket} in ${region}`;
    }
  },
  {
    name: 's3_delete_bucket',
    description: 'Delete an empty S3 bucket.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket']
    },
    handler: async ({ bucket, region }) => {
      const client = getClient(region);
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
      return `🗑️ Deleted bucket s3://${bucket}`;
    }
  },
  {
    name: 's3_search',
    description: 'Search for objects in a bucket by key pattern. Lists all objects matching a prefix and optionally filters by substring or suffix.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'Bucket name' },
        prefix: { type: 'string', description: 'Key prefix to search within' },
        contains: { type: 'string', description: 'Substring the key must contain (optional)' },
        suffix: { type: 'string', description: 'Key must end with this (e.g. ".csv", ".json")' },
        limit: { type: 'number', description: 'Max results (default 50)' },
        region: { type: 'string', description: 'AWS region (optional)' }
      },
      required: ['bucket']
    },
    handler: async ({ bucket, prefix = '', contains, suffix, limit = 50, region }) => {
      const client = getClient(region);
      const matches = [];
      let token;

      do {
        const res = await client.send(new ListObjectsV2Command({
          Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000
        }));
        for (const o of (res.Contents || [])) {
          if (contains && !o.Key.includes(contains)) continue;
          if (suffix && !o.Key.endsWith(suffix)) continue;
          matches.push(o);
          if (matches.length >= limit) break;
        }
        token = res.IsTruncated ? res.NextContinuationToken : null;
      } while (token && matches.length < limit);

      if (!matches.length) return `No objects found in s3://${bucket}/${prefix} matching filters.`;

      const lines = [`Found ${matches.length} objects in s3://${bucket}/:\n`];
      for (const o of matches) {
        lines.push(`  📄 ${o.Key}  ${fmtSize(o.Size)}  ${fmtDate(o.LastModified)}`);
      }
      return lines.join('\n');
    }
  }
];
