#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync , readdirSync } from 'fs';
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
    const configPath = join(configDir, 'aws.json');
    if (existsSync(configPath)) {
      const { rmSync } = await import('fs');
      rmSync(configPath);
      console.log('  Configuration cleared. Run this command again to reconnect.\n');
    } else {
      console.log('  No configuration to clear.\n');
    }
    rl.close();
    process.exit(0);
  } else {
    console.log(`
@antidrift/mcp-aws — AWS for Claude

Usage:
  antidrift connect aws               Connect AWS
  antidrift connect aws status        Check connection status
  antidrift connect aws reset         Clear configuration
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
  \u2502  antidrift v${version.padEnd(16)}\u2502
  \u2502  AWS                        \u2502
  \u2502                             \u2502
  \u2502  https://antidrift.io       \u2502
  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`);

  console.log('  \u26a0 By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
  console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
  console.log('');

  // Check if aws CLI is installed
  try {
    execSync('which aws', { encoding: 'utf8', stdio: 'pipe' });
  } catch {
    console.log('  \u2717 AWS CLI is not installed.\n');
    console.log('  Install AWS CLI: https://aws.amazon.com/cli/\n');
    rl.close();
    process.exit(1);
  }

  // Check if aws CLI is configured
  let identity;
  try {
    const result = execSync('aws sts get-caller-identity --output json', { encoding: 'utf8', stdio: 'pipe', timeout: 15000 });
    identity = JSON.parse(result);
  } catch {
    console.log('  \u2717 AWS CLI is not configured.\n');
    console.log('  Run: aws configure\n');
    rl.close();
    process.exit(1);
  }

  console.log(`  \u2713 AWS Account: ${identity.Account}`);
  console.log(`    ARN: ${identity.Arn}\n`);

  const configPath = join(configDir, 'aws.json');

  // Detect or ask for region
  let region = '';
  try {
    region = execSync('aws configure get region', { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}

  if (region) {
    console.log(`  Detected region: ${region}`);
    const override = await ask(`  Use this region? (Y/n or enter new region): `);
    const trimmed = override.trim();
    if (trimmed && trimmed.toLowerCase() !== 'y' && trimmed.toLowerCase() !== 'yes') {
      region = trimmed;
    }
  } else {
    region = await ask('  AWS region (e.g. us-east-1): ');
    region = region.trim();
  }

  if (!region) {
    console.log('  No region provided. Defaulting to us-east-1');
    region = 'us-east-1';
  }

  console.log(`  Region: ${region}\n`);

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ region }, null, 2));
  writeMcpConfig();
  console.log('  \u2713 AWS connected (S3, Lambda, ECS, CloudWatch, SQS, Cost Explorer)');
  console.log('  Restart your agent to use it.\n');
  rl.close();
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'aws.json'));
  const icon = hasConfig ? '\u2713' : '\u25cb';
  console.log(`\n  ${icon} AWS \u2014 ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    S3, Lambda, ECS, CloudWatch Logs, SQS, Cost Explorer\n');
}

function parsePlatformFlags() {
  const argv = process.argv;
  const isGlobal = !argv.includes('--local');
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
  const isGlobal = !process.argv.includes('--local');
  const serverDir = isGlobal
    ? join(homedir(), '.antidrift', 'tools', 'aws')
    : join(process.cwd(), '.mcp-servers', 'aws');
  const pkgDir = join(__dirname, '..');

  mkdirSync(serverDir, { recursive: true });
  if (isGlobal) {
    for (const f of readdirSync(join(pkgDir, 'tools'))) {
      cpSync(join(pkgDir, 'tools', f), join(serverDir, f));
    }
    cpSync(join(pkgDir, 'lib', 'client.mjs'), join(serverDir, 'client.mjs'));
  } else {

  // Always copy server files to .mcp-servers/ regardless of target
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  cpSync(join(pkgDir, 'connectors', 'aws.mjs'), join(serverDir, 'connectors', 'aws.mjs'));

  // Determine platform targets
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
    zeroConfig.credentials['aws'] = { file: join(homedir(), '.antidrift', 'aws.json') };
    writeFileSync(zeroConfigPath, JSON.stringify(zeroConfig, null, 2));
    console.log('  ✓ Registered with global zeromcp (~/.antidrift/zeromcp.config.json)');
  } else {
    const mcpPath = join(process.cwd(), '.mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-aws'] = {
      command: 'node',
      args: [join('.mcp-servers', 'aws', 'server.mjs')]
    };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    writeDesktopConfig('antidrift-aws', serverPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop)');
  }
}

main().catch(console.error);
