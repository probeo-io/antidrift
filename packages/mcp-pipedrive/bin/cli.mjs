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
    console.log('');
    console.log('  By installing this connector, you acknowledge that data accessed');
    console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
    console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
    console.log('');

    const configPath = join(configDir, 'pipedrive.json');
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
@antidrift/mcp-pipedrive — Pipedrive CRM for Claude

Usage:
  antidrift connect pipedrive               Connect Pipedrive
  antidrift connect pipedrive status        Check connection status
  antidrift connect pipedrive reset         Clear credentials
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
  ┌─────────────────────────────────────┐
  │  antidrift                          │
  │  Pipedrive CRM                      │
  │                                     │
  │  https://antidrift.io               │
  │  github.com/probeo-io/antidrift     │
  │  MIT License                        │
  └─────────────────────────────────────┘
`);

  console.log('  By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
  console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
  console.log('');

  const configPath = join(configDir, 'pipedrive.json');
  if (existsSync(configPath)) {
    console.log('  Already authorized — updating server files.\n');
    writeMcpConfig();
    console.log('  Pipedrive updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  console.log('  To get your API token:\n');
  console.log('  1. Go to Pipedrive → Settings (gear icon)');
  console.log('  2. Personal preferences → API');
  console.log('  3. Copy your personal API token');
  console.log('');

  const domain = await ask('  Company domain (e.g. "yourcompany" from yourcompany.pipedrive.com): ');

  if (!domain.trim()) {
    console.log('  No domain provided.\n');
    return;
  }

  const apiToken = await ask('  API token: ');

  if (!apiToken.trim()) {
    console.log('  No token provided.\n');
    return;
  }

  const masked = '*'.repeat(Math.max(0, apiToken.trim().length - 5)) + apiToken.trim().slice(-5);
  console.log(`  Token: ${masked}\n`);

  // Verify the token works
  console.log('  Verifying...');
  try {
    const res = await fetch(`https://${domain.trim()}.pipedrive.com/api/v1/users/me?api_token=${apiToken.trim()}`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    console.log(`  Connected as: ${data.data?.name || 'OK'} (${data.data?.email || ''})\n`);
  } catch (err) {
    console.log(`  Invalid token or connection failed: ${err.message}\n`);
    return;
  }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ apiToken: apiToken.trim(), domain: domain.trim() }, null, 2));
  writeMcpConfig();
  console.log('  Pipedrive connected (deals, contacts, organizations, activities, notes)');
  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'pipedrive.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Pipedrive CRM — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    Deals, contacts, organizations, activities, notes\n');
}

function parsePlatformFlags() {
  const argv = process.argv;
  const hasClaudeCode = argv.includes('--claude-code');
  const hasCowork = argv.includes('--cowork');
  const hasAll = argv.includes('--all');

  if (hasAll) return { claudeCode: true, cowork: true };
  if (hasClaudeCode && !hasCowork) return { claudeCode: true, cowork: false };
  if (hasCowork && !hasClaudeCode) return { claudeCode: false, cowork: true };

  const desktopConfigPath = getDesktopConfigPath();
  const coworkDetected = desktopConfigPath && existsSync(desktopConfigPath);
  return { claudeCode: true, cowork: coworkDetected };
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
  const cwd = process.cwd();
  const serverDir = join(cwd, '.mcp-servers', 'pipedrive');
  const pkgDir = join(__dirname, '..');

  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  cpSync(join(pkgDir, 'connectors', 'pipedrive.mjs'), join(serverDir, 'connectors', 'pipedrive.mjs'));

  const targets = parsePlatformFlags();

  if (targets.claudeCode) {
    const mcpPath = join(cwd, '.mcp.json');
    let config = {};

    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers['antidrift-pipedrive'] = {
      command: 'node',
      args: [join('.mcp-servers', 'pipedrive', 'server.mjs')]
    };

    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    const absoluteServerPath = join(cwd, '.mcp-servers', 'pipedrive', 'server.mjs');
    writeDesktopConfig('antidrift-pipedrive', absoluteServerPath);
    console.log('  Wrote claude_desktop_config.json (Claude Desktop / Cowork)');
  }
}

main().catch(console.error);
