import { execSync as _execSyncDefault } from 'child_process';

/**
 * Sanitize a string for safe shell usage.
 * Only allows alphanumeric, hyphens, underscores, dots, slashes, colons, equals, and at signs.
 */
export function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Remove any characters that could be used for shell injection
  return str.replace(/[^a-zA-Z0-9\-_./=:@+ ]/g, '');
}

export function createClient(credentials) {
  const region = credentials?.region || 'us-east-1';
  const execSync = credentials?._execSync || _execSyncDefault;

  /**
   * Execute an AWS CLI command and return parsed JSON.
   */
  function awsCli(command) {
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
    return execSync(`aws ${command} --region ${sanitize(region)}`, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  return { awsCli, awsCliRaw };
}
