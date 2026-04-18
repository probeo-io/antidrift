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

export {
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
  GetBucketEncryptionCommand,
  getSignedUrl
};

export function createClient(credentials) {
  function getClient(region) {
    const cfg = {
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    };
    if (region || credentials.region) cfg.region = region || credentials.region;
    return new S3Client(cfg);
  }

  return { getClient };
}

export function fmtSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function fmtDate(d) {
  return d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '?';
}
