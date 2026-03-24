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
  mkdirSync(configDir, { recursive: true });

  const apiKey = await ask('\n  Attio API key: ');

  if (!apiKey.trim()) {
    console.log('  No key provided.\n');
    return;
  }

  writeFileSync(join(configDir, 'attio.json'), JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
  writeMcpConfig();
  console.log('  Attio connected. Restart Claude Code to use it.\n');
}

function status() {
  const hasConfig = existsSync(join(configDir, 'attio.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Attio CRM — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    People, companies, deals, notes\n');
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
