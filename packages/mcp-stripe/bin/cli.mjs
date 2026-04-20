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


    console.log('');
  console.log('  ⚠ By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
  console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
  console.log('');

  const configPath = join(configDir, 'stripe.json');
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
@antidrift/mcp-stripe — Stripe for your AI agent

Usage:
  antidrift connect stripe               Connect Stripe
  antidrift connect stripe status        Check connection status
  antidrift connect stripe reset         Clear credentials (use to switch test ↔ live keys)
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
    ┌─────────────────────────────────────┐
  │  antidrift v${version.padEnd(24)}│
  │  Stripe                              │
  │                                     │
  │  https://antidrift.io               │
  │  github.com/probeo-io/antidrift     │
  │  MIT License                        │
  └─────────────────────────────────────┘
`);

  const configPath = join(configDir, 'stripe.json');
  if (existsSync(configPath)) {
    console.log('  Already authorized — updating server files.\n');
    await writeMcpConfig();
    console.log('  ✓ Stripe updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  console.log('  To get your API key:\n');
  console.log('  1. Go to https://dashboard.stripe.com/apikeys');
  console.log('  2. Copy your Secret key (starts with sk_live_ or sk_test_)');
  console.log('  3. Paste it below\n');

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
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const available = data.available || [];
    const summary = available.map(b => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`).join(', ');
    console.log(`  ✓ Connected — balance: ${summary || 'OK'}\n`);
  } catch (err) {
    console.log(`  ✗ Invalid key or connection failed: ${err.message}\n`);
    return;
  }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
  await writeMcpConfig();
  console.log('  ✓ Stripe connected (customers, products, invoices, subscriptions, charges)\n');
  console.log('  ⚠ WARNING: This connector can create invoices, modify customers,');
  console.log('    and cancel subscriptions. It CANNOT process credit card payments');
  console.log('    directly — payments go through Stripe\'s hosted pages (PCI compliant).');
  console.log('    Use a test key (sk_test_) to try it safely before using live.\n');

  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'stripe.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Stripe — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    Customers, products, invoices, subscriptions, charges\n');
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

async function writeMcpConfig() {
  const isGlobal = !process.argv.includes('--local');
  const serverDir = isGlobal
    ? join(homedir(), '.antidrift', 'tools', 'stripe')
    : join(process.cwd(), '.mcp-servers', 'stripe');
  const pkgDir = join(__dirname, '..');

  mkdirSync(serverDir, { recursive: true });
  if (isGlobal) {
    for (const f of readdirSync(join(pkgDir, 'tools'))) {
      cpSync(join(pkgDir, 'tools', f), join(serverDir, f));
    }
    cpSync(join(pkgDir, 'lib', 'client.mjs'), join(serverDir, 'client.mjs'));
    writeFileSync(join(serverDir, 'package.json'), JSON.stringify({"type":"module","dependencies":{"stripe":"*"}}));
    console.log('    Installing stripe dependencies...');
    execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });
  } else {

  // Always copy server files to .mcp-servers/ regardless of target
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  for (const file of ['server.mjs']) {
    cpSync(join(pkgDir, file), join(serverDir, file));
  }
  for (const file of readdirSync(join(pkgDir, 'connectors'))) {
    cpSync(join(pkgDir, 'connectors', file), join(serverDir, 'connectors', file));
  }

  // Install stripe dependency
  writeFileSync(join(serverDir, 'package.json'), JSON.stringify({ type: 'module', dependencies: { stripe: '*' } }));
  console.log('  Installing Stripe dependencies...');
  execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });

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
    zeroConfig.credentials['stripe'] = { file: join(homedir(), '.antidrift', 'stripe.json') };
    writeFileSync(zeroConfigPath, JSON.stringify(zeroConfig, null, 2));
    console.log('  ✓ Registered with global zeromcp (~/.antidrift/zeromcp.config.json)');
  } else {
    const mcpPath = join(process.cwd(), '.mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-stripe'] = {
      command: 'node',
      args: [join('.mcp-servers', 'stripe', 'server.mjs')]
    };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    writeDesktopConfig('antidrift-stripe', serverPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop)');
  }
}

main().catch(console.error);
