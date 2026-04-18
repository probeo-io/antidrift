#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const configDir = join(homedir(), '.antidrift');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise((resolve) => {
    rl.question(q, (answer) => { resolve(answer); });
  });
}

async function main() {
  const command = process.argv[2]?.startsWith('-') ? null : process.argv[2];

  if (command === 'add' || command === 'setup' || !command) {
    await setup();
  } else if (command === 'status') {
    status();
  } else if (command === 'reset') {
    console.log('  AWS S3 uses your standard AWS credentials (~/.aws/credentials).');
    console.log('  Run: aws configure\n');
    rl.close();
    process.exit(0);
  } else {
    console.log(`
@antidrift/mcp-aws-s3 — S3 for your AI agent

Usage:
  antidrift connect aws-s3               Connect AWS S3
  antidrift connect aws-s3 status        Check connection status
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
  ┌─────────────────────────────────────┐
  │  antidrift v${version.padEnd(24)}│
  │  AWS S3                             │
  │                                     │
  │  https://antidrift.io               │
  └─────────────────────────────────────┘
`);

  console.log('  ⚠ By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
  console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
  console.log('');

  // Check AWS credentials
  let identity;
  try {
    const result = execSync('aws sts get-caller-identity --output json', { encoding: 'utf8', stdio: 'pipe', timeout: 15000 });
    identity = JSON.parse(result);
  } catch {
    console.log('  ✗ AWS credentials not configured.\n');
    console.log('  Run: aws configure\n');
    rl.close();
    process.exit(1);
  }

  console.log(`  ✓ AWS Account: ${identity.Account}`);
  console.log(`    ARN: ${identity.Arn}\n`);

  writeMcpConfig();
  console.log('  ✓ AWS S3 connected (buckets, objects, presigned URLs, search, bucket config)');
  console.log('  Restart your agent to use it.\n');
  rl.close();
  process.exit(0);
}

function status() {
  let hasCredentials = false;
  try {
    execSync('aws sts get-caller-identity --output json', { encoding: 'utf8', stdio: 'pipe', timeout: 15000 });
    hasCredentials = true;
  } catch {}
  const icon = hasCredentials ? '✓' : '○';
  console.log(`\n  ${icon} AWS S3 — ${hasCredentials ? 'connected' : 'not connected'}`);
  console.log('    Buckets, objects, presigned URLs, search, bucket config\n');
}

function parsePlatformFlags() {
  const argv = process.argv;
  const isGlobal = argv.includes('--global') || argv.includes('-g');
  const desktopConfigPath = getDesktopConfigPath();
  const cowork = !!(desktopConfigPath && existsSync(desktopConfigPath));
  return { global: isGlobal, cowork };
}

function getDesktopConfigPath() {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

function writeDesktopConfig(serverName, absoluteServerPath) {
  const configPath = getDesktopConfigPath();
  const configDir = dirname(configPath);

  mkdirSync(configDir, { recursive: true });

  let config = {};
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers[serverName] = {
    command: 'node',
    args: [absoluteServerPath]
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function writeMcpConfig() {
  const isGlobal = process.argv.includes('--global') || process.argv.includes('-g');
  const serverDir = isGlobal
    ? join(homedir(), '.antidrift', 'tools', 'aws-s3')
    : join(process.cwd(), '.mcp-servers', 'aws-s3');
  const pkgDir = join(__dirname, '..');

  mkdirSync(serverDir, { recursive: true });
  if (isGlobal) {
    for (const f of readdirSync(join(pkgDir, 'tools'))) {
      cpSync(join(pkgDir, 'tools', f), join(serverDir, f));
    }
    cpSync(join(pkgDir, 'lib', 'client.mjs'), join(serverDir, 'client.mjs'));
    writeFileSync(join(serverDir, 'package.json'), JSON.stringify({"type":"module","dependencies":{"@aws-sdk/client-s3":"*","@aws-sdk/s3-request-presigner":"*"}}));
    console.log('    Installing AWS SDK dependencies...');
    execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });
  } else {

  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  for (const file of readdirSync(join(pkgDir, 'connectors'))) {
    cpSync(join(pkgDir, 'connectors', file), join(serverDir, 'connectors', file));
  }

  // Install dependencies
  writeFileSync(join(serverDir, 'package.json'), JSON.stringify({
    type: 'module',
    dependencies: { '@aws-sdk/client-s3': '*', '@aws-sdk/s3-request-presigner': '*' }
  }));
  console.log('  Installing AWS SDK dependencies...');
  execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });
  }

  const targets = parsePlatformFlags();
  const serverPath = join(serverDir, 'server.mjs');

  if (targets.global) {
    const zeroConfigPath = join(homedir(), '.antidrift', 'zeromcp.config.json');
    let zeroConfig = { tools: [], credentials: {} };
    if (existsSync(zeroConfigPath)) {
      try { zeroConfig = JSON.parse(readFileSync(zeroConfigPath, 'utf8')); } catch {}
    }
    const toolsRoot = join(homedir(), '.antidrift', 'tools');
    if (!Array.isArray(zeroConfig.tools)) zeroConfig.tools = [];
    if (!zeroConfig.tools.includes(toolsRoot)) zeroConfig.tools.push(toolsRoot);
    if (!zeroConfig.credentials) zeroConfig.credentials = {};
    zeroConfig.credentials['aws-s3'] = { file: join(homedir(), '.antidrift', 'aws-s3.json') };
    writeFileSync(zeroConfigPath, JSON.stringify(zeroConfig, null, 2));
    console.log('  ✓ Registered with global zeromcp (~/.antidrift/zeromcp.config.json)');
  } else {
    const mcpPath = join(process.cwd(), '.mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-aws-s3'] = {
      command: 'node',
      args: [join('.mcp-servers', 'aws-s3', 'server.mjs')]
    };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    writeDesktopConfig('antidrift-aws-s3', serverPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop)');
  }
}

main().catch(console.error);
