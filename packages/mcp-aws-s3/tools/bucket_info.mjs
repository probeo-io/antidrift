import { createClient, GetBucketLocationCommand, GetBucketVersioningCommand, GetBucketEncryptionCommand, GetBucketTaggingCommand, GetBucketCorsCommand, GetBucketLifecycleConfigurationCommand } from './client.mjs';

export default {
  description: 'Get detailed info about a bucket — location, versioning, encryption, tags, lifecycle, CORS.',
  input: {
    bucket: { type: 'string', description: 'Bucket name' },
    region: { type: 'string', description: 'AWS region (optional)', optional: true }
  },
  execute: async ({ bucket, region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
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
};
