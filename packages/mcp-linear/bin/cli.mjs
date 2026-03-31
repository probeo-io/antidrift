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

    const configPath = join(configDir, 'linear.json');
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
@antidrift/mcp-linear — Linear for Claude

Usage:
  antidrift connect linear               Connect Linear
  antidrift connect linear status        Check connection status
  antidrift connect linear reset         Clear credentials
`);
  }

  rl.close();
}

async function setup() {
  console.log(`
  ┌─────────────────────────────────────┐
  │  antidrift                          │
  │  Linear                             │
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

  const configPath = join(configDir, 'linear.json');
  if (existsSync(configPath)) {
    console.log('  Already authorized — updating server files.\n');
    writeMcpConfig();
    console.log('  Linear updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  console.log('  To get your API key:\n');
  console.log('  1. Go to https://linear.app');
  console.log('  2. Settings (top left) → Account → API');
  console.log('  3. Create a new Personal API Key');
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
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': apiKey.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: '{ viewer { id name email } }' })
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0].message);
    const user = data.data.viewer;
    console.log(`  Connected as: ${user.name} (${user.email})\n`);
  } catch (err) {
    console.log(`  Invalid key or connection failed: ${err.message}\n`);
    return;
  }

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
  writeMcpConfig();
  console.log('  Linear connected (issues, projects, cycles, teams, comments)');
  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'linear.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Linear — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    Issues, projects, cycles, teams, comments\n');
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
  const serverDir = join(cwd, '.mcp-servers', 'linear');
  const pkgDir = join(__dirname, '..');

  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  cpSync(join(pkgDir, 'connectors', 'linear.mjs'), join(serverDir, 'connectors', 'linear.mjs'));

  const targets = parsePlatformFlags();

  if (targets.claudeCode) {
    const mcpPath = join(cwd, '.mcp.json');
    let config = {};

    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers['antidrift-linear'] = {
      command: 'node',
      args: [join('.mcp-servers', 'linear', 'server.mjs')]
    };

    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    const absoluteServerPath = join(cwd, '.mcp-servers', 'linear', 'server.mjs');
    writeDesktopConfig('antidrift-linear', absoluteServerPath);
    console.log('  Wrote claude_desktop_config.json (Claude Desktop / Cowork)');
  }
}

main().catch(console.error);
