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


async function privacyCheck() {

  console.log("");
  console.log("  ⚠ PRIVACY NOTICE");
  console.log("  Data accessed through this connector will be sent to your AI model");
  console.log("  provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.");
  console.log("  Do not connect services containing data you are not comfortable sharing.");
  console.log("");

  const answer = await ask("  I understand (Y/N): ");

  if (!answer.trim().toLowerCase().startsWith("y")) {
    console.log("\n  Setup cancelled.\n");
    process.exit(0);
  }
  console.log("");
}

async function main() {
  const command = process.argv[2];

  if (command === 'add' || command === 'setup' || !command) {
    await setup();
  } else if (command === 'status') {
    status();
  } else if (command === 'reset') {
  await privacyCheck();


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
  antidrift connect attio               Connect Attio
  antidrift connect attio status        Check connection status
  antidrift connect attio reset         Clear credentials
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
    console.log('  Already authorized — updating server files.\n');
    writeMcpConfig();
    console.log('  ✓ Attio updated. Restart your agent to pick up changes.\n');
    process.exit(0);
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

  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasConfig = existsSync(join(configDir, 'attio.json'));
  const icon = hasConfig ? '✓' : '○';
  console.log(`\n  ${icon} Attio CRM — ${hasConfig ? 'connected' : 'not connected'}`);
  console.log('    People, companies, deals, tasks, notes\n');
}

function parsePlatformFlags() {
  const argv = process.argv;
  const hasClaudeCode = argv.includes('--claude-code');
  const hasCowork = argv.includes('--cowork');
  const hasAll = argv.includes('--all');

  if (hasAll) return { claudeCode: true, cowork: true };
  if (hasClaudeCode && !hasCowork) return { claudeCode: true, cowork: false };
  if (hasCowork && !hasClaudeCode) return { claudeCode: false, cowork: true };

  // Auto-detect: always write .mcp.json; write Desktop config if it exists
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
  const serverDir = join(cwd, '.mcp-servers', 'attio');
  const pkgDir = join(__dirname, '..');

  // Always copy server files to .mcp-servers/ regardless of target
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  cpSync(join(pkgDir, 'server.mjs'), join(serverDir, 'server.mjs'));
  cpSync(join(pkgDir, 'connectors', 'attio.mjs'), join(serverDir, 'connectors', 'attio.mjs'));

  // Determine platform targets
  const targets = parsePlatformFlags();

  // Write .mcp.json (Claude Code) — relative paths
  if (targets.claudeCode) {
    const mcpPath = join(cwd, '.mcp.json');
    let config = {};

    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers['antidrift-attio'] = {
      command: 'node',
      args: [join('.mcp-servers', 'attio', 'server.mjs')]
    };

    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  // Write claude_desktop_config.json (Cowork / Claude Desktop) — absolute paths
  if (targets.cowork) {
    const absoluteServerPath = join(cwd, '.mcp-servers', 'attio', 'server.mjs');
    writeDesktopConfig('antidrift-attio', absoluteServerPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop / Cowork)');
  }
}

main().catch(console.error);
