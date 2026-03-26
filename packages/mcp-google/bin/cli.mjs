#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
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
    console.log('  Already connected. Use "reset" to re-authorize.\n');
    status();
    return;
  }

  const { runAuthFlow } = await import('../auth-google.mjs');
  await runAuthFlow();

  writeMcpConfig();
  console.log('  ✓ Google connected (Sheets, Docs, Drive, Gmail, Calendar)');
  console.log('  Restart Claude Code to use it.\n');
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

function writeMcpConfig() {
  const mcpPath = join(process.cwd(), '.mcp.json');
  let config = {};

  if (existsSync(mcpPath)) {
    try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers['antidrift-google'] = {
    command: 'node',
    args: [join(__dirname, '..', 'server.mjs')]
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2));
}

main().catch(console.error);
