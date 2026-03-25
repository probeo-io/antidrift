#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configDir = join(homedir(), '.antidrift');

async function main() {
  const command = process.argv[2];

  if (command === 'add' || command === 'setup' || !command) {
    await setup();
  } else if (command === 'status') {
    status();
  } else {
    console.log(`
@antidrift/mcp-google — Google Workspace for Claude

Usage:
  npx @antidrift/mcp-google              Connect Google (Sheets, Docs, Drive, Gmail, Calendar)
  npx @antidrift/mcp-google status       Check connection status
`);
  }
}

async function setup() {
  mkdirSync(configDir, { recursive: true });

  const credsPath = join(configDir, 'google-credentials.json');
  if (!existsSync(credsPath)) {
    console.log('\n  Google OAuth credentials not found.\n');
    console.log('  1. Go to https://console.cloud.google.com');
    console.log('  2. APIs & Services → Credentials → Create OAuth Client ID');
    console.log('  3. Application type: Desktop app');
    console.log('  4. Download the JSON file');
    console.log(`  5. Save it to: ${credsPath}\n`);
    console.log('  Then run this command again.');
    return;
  }

  const { runAuthFlow } = await import('../auth-google.mjs');
  await runAuthFlow();

  writeMcpConfig();
  console.log('  Google connected (Sheets, Docs, Drive, Gmail, Calendar).');
  console.log('  Restart Claude Code to use it.\n');
}

function status() {
  const hasToken = existsSync(join(configDir, 'google-token.json'));
  const icon = hasToken ? '✓' : '○';
  console.log(`\n  ${icon} Google Workspace — ${hasToken ? 'connected' : 'not connected'}`);
  console.log('    Sheets, Docs, Drive, Gmail, Calendar\n');
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
