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
@antidrift/mcp-stripe — Stripe for Claude

Usage:
  npx @antidrift/mcp-stripe              Connect Stripe
  npx @antidrift/mcp-stripe status       Check connection status
`);
  }

  rl.close();
}

async function setup() {
  mkdirSync(configDir, { recursive: true });

  const apiKey = await ask('\n  Stripe API key (sk_...): ');

  if (!apiKey.trim().startsWith('sk_')) {
    console.log('  Invalid key. Should start with sk_live_ or sk_test_\n');
    return;
  }

  writeFileSync(join(configDir, 'stripe.json'), JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
  writeMcpConfig();
  console.log('  Stripe connected. Restart Claude Code to use it.\n');
}

function status() {
  const hasConfig = existsSync(join(configDir, 'stripe.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Stripe — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    Invoices, customers, products\n');
}

function writeMcpConfig() {
  const mcpPath = join(process.cwd(), '.mcp.json');
  let config = {};

  if (existsSync(mcpPath)) {
    try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers['antidrift-stripe'] = {
    command: 'node',
    args: [join(__dirname, '..', 'server.mjs')]
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2));
}

main().catch(console.error);
