#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync , readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

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
    console.log('  \u26a0 By installing this connector, you acknowledge that data accessed');
    console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
    console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
    console.log('');

    const configPath = join(configDir, 'hubspot.json');
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
@antidrift/mcp-hubspot-crm \u2014 HubSpot CRM for Claude

Usage:
  antidrift connect hubspot-crm               Connect HubSpot CRM
  antidrift connect hubspot-crm status        Check connection status
  antidrift connect hubspot-crm reset         Clear credentials
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
  \u2502  antidrift v${version.padEnd(16)}\u2502
  \u2502  HubSpot CRM                \u2502
  \u2502                             \u2502
  \u2502  https://antidrift.io       \u2502
  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`);

  console.log('  \u26a0 By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
  console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
  console.log('');

  const configPath = join(configDir, 'hubspot.json');
  if (existsSync(configPath)) {
    console.log('  Already authorized \u2014 updating server files.\n');
    writeMcpConfig();
    console.log('  \u2713 HubSpot CRM updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  console.log('  To get your access token:\n');
  console.log('  1. Go to HubSpot \u2192 Settings \u2192 Integrations \u2192 Private Apps');
  console.log('  2. Create a private app');
  console.log('  3. Under Scopes, add:');
  console.log('     crm.objects.contacts.read, crm.objects.contacts.write');
  console.log('     crm.objects.companies.read, crm.objects.companies.write');
  console.log('     crm.objects.deals.read, crm.objects.deals.write');
  console.log('  4. Copy the access token and paste it below\n');

  const token = await ask('  Access token: ');

  if (!token.trim()) {
    console.log('  No token provided.\n');
    return;
  }

  const masked = '*'.repeat(Math.max(0, token.trim().length - 5)) + token.trim().slice(-5);
  console.log(`  Token: ${masked}\n`);

  // Verify the token works
  console.log('  Verifying...');
  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      headers: { 'Authorization': `Bearer ${token.trim()}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    await res.json();
    console.log('  \u2713 Connected to HubSpot CRM\n');
  } catch (err) {
    console.log(`  \u2717 Invalid token or connection failed: ${err.message}\n`);
    return;
  }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ accessToken: token.trim() }, null, 2));
  writeMcpConfig();
  console.log('  \u2713 HubSpot CRM connected (contacts, companies, deals, notes)');

  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'hubspot.json'));
  const icon = hasConfig ? '\u2713' : '\u25cb';
  console.log(`\n  ${icon} HubSpot CRM \u2014 ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    Contacts, companies, deals, notes\n');
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
    ? join(homedir(), '.antidrift', 'tools', 'hubspot-crm')
    : join(process.cwd(), '.mcp-servers', 'hubspot-crm');
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
  cpSync(join(pkgDir, 'connectors', 'hubspot-crm.mjs'), join(serverDir, 'connectors', 'hubspot-crm.mjs'));

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
    zeroConfig.credentials['hubspot-crm'] = { file: join(homedir(), '.antidrift', 'hubspot-crm.json') };
    writeFileSync(zeroConfigPath, JSON.stringify(zeroConfig, null, 2));
    console.log('  ✓ Registered with global zeromcp (~/.antidrift/zeromcp.config.json)');
  } else {
    const mcpPath = join(process.cwd(), '.mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-hubspot-crm'] = {
      command: 'node',
      args: [join('.mcp-servers', 'hubspot-crm', 'server.mjs')]
    };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    writeDesktopConfig('antidrift-hubspot-crm', serverPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop)');
  }
}

main().catch(console.error);
