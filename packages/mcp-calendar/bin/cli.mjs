#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const credsDir = join(homedir(), '.antidrift', 'credentials', 'google');


async function privacyCheck() {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, (a) => { r(a); }));

  console.log("");
  console.log("  ⚠ PRIVACY NOTICE");
  console.log("  Data accessed through this connector will be sent to your AI model");
  console.log("  provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.");
  console.log("  Do not connect services containing data you are not comfortable sharing.");
  console.log("");

  const answer = await ask("  I understand (Y/N): ");
  rl.close();

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
    reset();
  } else {
    console.log(`
@antidrift/mcp-calendar — Google Calendar for your AI agent

Usage:
  antidrift connect calendar               Connect Google Calendar
  antidrift connect calendar status        Check connection status
  antidrift connect calendar reset         Clear credentials and re-authorize
`);
  }
}

async function setup() {
  console.log(`
  ┌─────────────────────────────┐
  │  antidrift                  │
  │  Google Calendar            │
  └─────────────────────────────┘
`);

  const tokenPath = join(credsDir, 'token.json');
  if (existsSync(tokenPath)) {
    console.log('  Already authorized — updating server files.\n');
    await writeMcpConfig();
    console.log('  ✓ Calendar updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  await privacyCheck();

  const { runAuthFlow } = await import('../auth-google.mjs');
  await runAuthFlow();

  await writeMcpConfig();
  console.log('  ✓ Google Calendar connected');

  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasToken = existsSync(join(credsDir, 'token.json'));
  const icon = hasToken ? '✓' : '○';
  console.log(`\n  ${icon} Google Calendar — ${hasToken ? 'connected' : 'not connected'}\n`);
}

function reset() {
  const tokenPath = join(credsDir, 'token.json');
  if (existsSync(tokenPath)) {
    rmSync(tokenPath);
    console.log('  Credentials cleared. Run this command again to re-authorize.\n');
  } else {
    console.log('  No credentials to clear.\n');
  }
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

async function writeMcpConfig() {
  const cwd = process.cwd();
  const serverDir = join(cwd, '.mcp-servers', 'calendar');
  const pkgDir = join(__dirname, '..');

  // Always copy server files to .mcp-servers/ regardless of target
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  for (const file of ['server.mjs', 'auth-google.mjs']) {
    cpSync(join(pkgDir, file), join(serverDir, file));
  }
  for (const file of readdirSync(join(pkgDir, 'connectors'))) {
    cpSync(join(pkgDir, 'connectors', file), join(serverDir, 'connectors', file));
  }

  // Install googleapis dependency
  writeFileSync(join(serverDir, 'package.json'), JSON.stringify({ type: 'module', dependencies: { googleapis: '*' } }));
  const { execSync } = await import('child_process');
  console.log('  Installing Google API dependencies...');
  execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });

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

    config.mcpServers['antidrift-calendar'] = {
      command: 'node',
      args: [join('.mcp-servers', 'calendar', 'server.mjs')]
    };

    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  // Write claude_desktop_config.json (Cowork / Claude Desktop) — absolute paths
  if (targets.cowork) {
    const absoluteServerPath = join(cwd, '.mcp-servers', 'calendar', 'server.mjs');
    writeDesktopConfig('antidrift-calendar', absoluteServerPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop / Cowork)');
  }
}

main().catch(console.error).finally(() => process.exit(0));
