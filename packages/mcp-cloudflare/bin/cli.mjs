#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configDir = join(homedir(), '.antidrift');

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise((resolve) => { rl.question(q, resolve); }); }

async function main() {
  const command = process.argv[2];
  if (command === 'add' || command === 'setup' || !command) { await setup(); }
  else if (command === 'status') { status(); }
  else if (command === 'reset') {
    console.log('\n  By installing this connector, you acknowledge that data accessed');
    console.log('  through it will be sent to your AI model provider. Press Ctrl+C to cancel.\n');
    const configPath = join(configDir, 'cloudflare.json');
    if (existsSync(configPath)) { const { rmSync } = await import('fs'); rmSync(configPath); console.log('  Credentials cleared.\n'); }
    else { console.log('  No credentials to clear.\n'); }
    rl.close(); process.exit(0);
  } else {
    console.log(`\n@antidrift/mcp-cloudflare — Cloudflare for Claude\n\nUsage:\n  antidrift connect cloudflare\n  antidrift connect cloudflare status\n  antidrift connect cloudflare reset\n`);
  }
  rl.close();
}

async function setup() {
  console.log(`\n  ┌─────────────────────────────────────┐\n  │  antidrift                          │\n  │  Cloudflare                         │\n  │                                     │\n  │  https://antidrift.io               │\n  │  github.com/probeo-io/antidrift     │\n  │  MIT License                        │\n  └─────────────────────────────────────┘\n`);
  console.log('  By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider. Press Ctrl+C to cancel.\n');

  const configPath = join(configDir, 'cloudflare.json');
  if (existsSync(configPath)) {
    console.log('  Already authorized — updating server files.\n');
    writeMcpConfig(); console.log('  Cloudflare updated. Restart your agent.\n'); process.exit(0);
  }

  console.log('  To get your API token:\n');
  console.log('  1. Go to https://dash.cloudflare.com/profile/api-tokens');
  console.log('  2. Create a token (or use "Edit zone DNS" + "Cloudflare Pages" templates)');
  console.log('  3. Copy and paste it below\n');

  const token = await ask('  API token: ');
  if (!token.trim()) { console.log('  No token provided.\n'); return; }

  console.log('  Verifying...');
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { 'Authorization': `Bearer ${token.trim()}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Invalid token');
    console.log(`  Token verified: ${data.result?.status || 'active'}\n`);
  } catch (err) { console.log(`  Invalid token: ${err.message}\n`); return; }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ token: token.trim() }, null, 2));
  writeMcpConfig();
  console.log('  Cloudflare connected (DNS, Pages, Workers, R2)');
  console.log('  Restart your agent to use it.\n'); process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'cloudflare.json'));
  console.log(`\n  ${hasConfig ? '✓' : '○'} Cloudflare — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    DNS, Pages, Workers, R2\n');
}

function parsePlatformFlags() {
  const argv = process.argv;
  if (argv.includes('--all')) return { claudeCode: true, cowork: true };
  if (argv.includes('--claude-code') && !argv.includes('--cowork')) return { claudeCode: true, cowork: false };
  if (argv.includes('--cowork') && !argv.includes('--claude-code')) return { claudeCode: false, cowork: true };
  const coworkDetected = existsSync(getDesktopConfigPath());
  return { claudeCode: true, cowork: coworkDetected };
}

function getDesktopConfigPath() {
  if (process.platform === 'win32') return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

function writeMcpConfig() {
  const cwd = process.cwd();
  const serverDir = join(cwd, '.mcp-servers', 'cloudflare');
  const pkgDir = join(__dirname, '..');
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  cpSync(join(pkgDir, 'connectors', 'cloudflare.mjs'), join(serverDir, 'connectors', 'cloudflare.mjs'));
  const targets = parsePlatformFlags();
  if (targets.claudeCode) {
    const mcpPath = join(cwd, '.mcp.json');
    let config = {}; if (existsSync(mcpPath)) { try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {} }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-cloudflare'] = { command: 'node', args: [join('.mcp-servers', 'cloudflare', 'server.mjs')] };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  Wrote .mcp.json (Claude Code)');
  }
  if (targets.cowork) {
    const configPath = getDesktopConfigPath();
    mkdirSync(dirname(configPath), { recursive: true });
    let config = {}; if (existsSync(configPath)) { try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch {} }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-cloudflare'] = { command: 'node', args: [join(cwd, '.mcp-servers', 'cloudflare', 'server.mjs')] };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('  Wrote claude_desktop_config.json (Claude Desktop / Cowork)');
  }
}

main().catch(console.error);
