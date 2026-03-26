#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const credsDir = join(homedir(), '.antidrift', 'credentials', 'google');

async function main() {
  const command = process.argv[2];

  if (command === 'add' || command === 'setup' || !command) {
    await setup();
  } else if (command === 'status') {
    status();
  } else if (command === 'reset') {
    reset();
  } else {
    console.log(`
@antidrift/mcp-google — Google Workspace for your AI agent

Usage:
  npx @antidrift/mcp-google              Connect Google (Sheets, Docs, Drive, Gmail, Calendar)
  npx @antidrift/mcp-google status       Check connection status
  npx @antidrift/mcp-google reset        Clear credentials and re-authorize
`);
  }
}

async function setup() {
  console.log(`
  ┌─────────────────────────────┐
  │  antidrift                  │
  │  Google Workspace           │
  └─────────────────────────────┘
`);

  const tokenPath = join(credsDir, 'token.json');
  if (existsSync(tokenPath)) {
    console.log('  Already authorized — updating server files.\n');
    await writeMcpConfig();
    console.log('  ✓ Google updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  const { runAuthFlow } = await import('../auth-google.mjs');
  await runAuthFlow();

  await writeMcpConfig();
  console.log('  ✓ Google connected (Sheets, Docs, Drive, Gmail, Calendar)');
  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasToken = existsSync(join(credsDir, 'token.json'));
  const icon = hasToken ? '✓' : '○';
  console.log(`\n  ${icon} Google Workspace — ${hasToken ? 'connected' : 'not connected'}`);
  console.log('    Sheets, Docs, Drive, Gmail, Calendar\n');
}

function reset() {
  const tokenPath = join(credsDir, 'token.json');
  if (existsSync(tokenPath)) {
    rmSync(tokenPath);
    console.log('  Credentials cleared. Run this command again to re-authorize.\n');
  } else {
    console.log('  No credentials to clear.\n');
  }
}

async function writeMcpConfig() {
  const cwd = process.cwd();
  const serverDir = join(cwd, '.mcp-servers', 'google');
  const pkgDir = join(__dirname, '..');

  // Copy server files to brain
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  for (const file of ['server.mjs', 'auth-google.mjs']) {
    cpSync(join(pkgDir, file), join(serverDir, file));
  }
  for (const file of readdirSync(join(pkgDir, 'connectors'))) {
    cpSync(join(pkgDir, 'connectors', file), join(serverDir, 'connectors', file));
  }

  // Install googleapis dependency
  writeFileSync(join(serverDir, 'package.json'), JSON.stringify({ type: 'module', dependencies: { googleapis: '*' } }));
  const { execSync } = await import('child_process');
  console.log('  Installing Google API dependencies...');
  execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });

  // Write .mcp.json pointing to local copy
  const mcpPath = join(cwd, '.mcp.json');
  let config = {};

  if (existsSync(mcpPath)) {
    try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers['antidrift-google'] = {
    command: 'node',
    args: [join('.mcp-servers', 'google', 'server.mjs')]
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
