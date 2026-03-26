#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configDir = join(homedir(), '.antidrift');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise((resolve) => {
    rl.question(q, (answer) => { resolve(answer); });
  });
}

async function main() {
  const command = process.argv[2];

  if (command === 'add' || command === 'setup' || !command) {
    await setup();
  } else if (command === 'status') {
    status();
  } else if (command === 'reset') {
    const configPath = join(configDir, 'attio.json');
    if (existsSync(configPath)) {
      const { rmSync } = await import('fs');
      rmSync(configPath);
      console.log('  Credentials cleared. Run this command again to reconnect.\n');
    } else {
      console.log('  No credentials to clear.\n');
    }
    rl.close();
    process.exit(0);
  } else {
    console.log(`
@antidrift/mcp-attio — Attio CRM for Claude

Usage:
  npx @antidrift/mcp-attio              Connect Attio
  npx @antidrift/mcp-attio status       Check connection status
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
  ┌─────────────────────────────┐
  │  antidrift                  │
  │  Attio CRM                  │
  └─────────────────────────────┘
`);

  const configPath = join(configDir, 'attio.json');
  if (existsSync(configPath)) {
    console.log('  Already connected. Use "reset" to reconnect.\n');
    status();
    return;
  }

  console.log('  To get your API key:\n');
  console.log('  1. Go to https://app.attio.com');
  console.log('  2. Settings (bottom left) → Developers → API Keys');
  console.log('  3. Create a new key with read/write access');
  console.log('  4. Copy the key and paste it below\n');

  const apiKey = await ask('  API key: ');

  if (!apiKey.trim()) {
    console.log('  No key provided.\n');
    return;
  }

  const masked = '*'.repeat(Math.max(0, apiKey.trim().length - 5)) + apiKey.trim().slice(-5);
  console.log(`  Key: ${masked}\n`);

  // Verify the key works
  console.log('  Verifying...');
  try {
    const res = await fetch('https://api.attio.com/v2/self', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    console.log(`  ✓ Connected to workspace: ${data.data?.workspace?.name || 'OK'}\n`);
  } catch (err) {
    console.log(`  ✗ Invalid key or connection failed: ${err.message}\n`);
    return;
  }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
  writeMcpConfig();
  console.log('  ✓ Attio connected (people, companies, deals, tasks, notes)');
  console.log('  Restart Claude Code to use it.\n');
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'attio.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Attio CRM — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    People, companies, deals, tasks, notes\n');
}

function writeMcpConfig() {
  const mcpPath = join(process.cwd(), '.mcp.json');
  let config = {};

  if (existsSync(mcpPath)) {
    try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers['antidrift-attio'] = {
    command: 'node',
    args: [join(__dirname, '..', 'server.mjs')]
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2));
}

main().catch(console.error);
