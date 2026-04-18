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
function ask(q) { return new Promise((resolve) => { rl.question(q, resolve); }); }

async function main() {
  const command = process.argv[2]?.startsWith('-') ? null : process.argv[2];
  if (command === 'add' || command === 'setup' || !command) { await setup(); }
  else if (command === 'status') { status(); }
  else if (command === 'reset') {
    console.log('\n  By installing this connector, you acknowledge that data accessed');
    console.log('  through it will be sent to your AI model provider. Press Ctrl+C to cancel.\n');
    const configPath = join(configDir, 'netlify.json');
    if (existsSync(configPath)) { const { rmSync } = await import('fs'); rmSync(configPath); console.log('  Credentials cleared.\n'); }
    else { console.log('  No credentials to clear.\n'); }
    rl.close(); process.exit(0);
  } else {
    console.log(`\n@antidrift/mcp-netlify — Netlify for Claude\n\nUsage:\n  antidrift connect netlify\n  antidrift connect netlify status\n  antidrift connect netlify reset\n`);
  }
  rl.close();
}

async function setup() {
  console.log(`\n  ┌─────────────────────────────────────┐\n  │  antidrift v${version.padEnd(24)}│\n  │  Netlify                            │\n  │                                     │\n  │  https://antidrift.io               │\n  │  github.com/probeo-io/antidrift     │\n  │  MIT License                        │\n  └─────────────────────────────────────┘\n`);
  console.log('  By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider. Press Ctrl+C to cancel.\n');

  const configPath = join(configDir, 'netlify.json');
  if (existsSync(configPath)) {
    console.log('  Already authorized — updating server files.\n');
    writeMcpConfig(); console.log('  Netlify updated. Restart your agent.\n'); process.exit(0);
  }

  console.log('  To get your token:\n');
  console.log('  1. Go to https://app.netlify.com/user/applications');
  console.log('  2. Under "Personal access tokens", create a new token');
  console.log('  3. Copy and paste it below\n');

  const token = await ask('  Token: ');
  if (!token.trim()) { console.log('  No token provided.\n'); return; }

  console.log('  Verifying...');
  try {
    const res = await fetch('https://api.netlify.com/api/v1/user', { headers: { 'Authorization': `Bearer ${token.trim()}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    console.log(`  Connected as: ${data.full_name || data.email || 'OK'}\n`);
  } catch (err) { console.log(`  Invalid token: ${err.message}\n`); return; }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ token: token.trim() }, null, 2));
  writeMcpConfig();
  console.log('  Netlify connected (sites, deploys, env vars, forms)');
  console.log('  Restart your agent to use it.\n'); process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'netlify.json'));
  console.log(`\n  ${hasConfig ? '✓' : '○'} Netlify — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    Sites, deploys, environment variables, forms\n');
}

function writeDesktopConfig(serverName, absoluteServerPath) {
  const configPath = getDesktopConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  let config = {};
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch {}
  }
  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers[serverName] = { command: 'node', args: [absoluteServerPath] };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function parsePlatformFlags() {
  const argv = process.argv;
  const isGlobal = argv.includes('--global') || argv.includes('-g');
  const desktopConfigPath = getDesktopConfigPath();
  const cowork = !!(desktopConfigPath && existsSync(desktopConfigPath));
  return { global: isGlobal, cowork };
}

function getDesktopConfigPath() {
  if (process.platform === 'win32') return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

function writeMcpConfig() {
  const isGlobal = process.argv.includes('--global') || process.argv.includes('-g');
  const serverDir = isGlobal
    ? join(homedir(), '.antidrift', 'tools', 'netlify')
    : join(process.cwd(), '.mcp-servers', 'netlify');
  const pkgDir = join(__dirname, '..');

  mkdirSync(serverDir, { recursive: true });
  if (isGlobal) {
    for (const f of readdirSync(join(pkgDir, 'tools'))) {
      cpSync(join(pkgDir, 'tools', f), join(serverDir, f));
    }
    cpSync(join(pkgDir, 'lib', 'client.mjs'), join(serverDir, 'client.mjs'));
  } else {
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  cpSync(join(pkgDir, 'connectors', 'netlify.mjs'), join(serverDir, 'connectors', 'netlify.mjs'));
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
    zeroConfig.credentials['netlify'] = { file: join(homedir(), '.antidrift', 'netlify.json') };
    writeFileSync(zeroConfigPath, JSON.stringify(zeroConfig, null, 2));
    console.log('  ✓ Registered with global zeromcp (~/.antidrift/zeromcp.config.json)');
  } else {
    const mcpPath = join(process.cwd(), '.mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-netlify'] = {
      command: 'node',
      args: [join('.mcp-servers', 'netlify', 'server.mjs')]
    };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    writeDesktopConfig('antidrift-netlify', serverPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop)');
  }
}

main().catch(console.error);
