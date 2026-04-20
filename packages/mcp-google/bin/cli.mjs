#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const credsDir = join(homedir(), '.antidrift', 'credentials', 'google');




async function main() {
  const command = process.argv[2]?.startsWith('-') ? null : process.argv[2];

  if (command === 'add' || command === 'setup' || !command) {
    await setup();
  } else if (command === 'status') {
    status();
  } else if (command === 'reset') {
    reset();
  } else {
    console.log(`
@antidrift/mcp-google — Google Workspace for your AI agent

Usage:
  antidrift connect google               Connect Google Workspace
  antidrift connect google status        Check connection status
  antidrift connect google reset         Clear credentials and re-authorize
`);
  }
}

async function setup() {
  console.log(`
    ┌─────────────────────────────────────┐
  │  antidrift v${version.padEnd(24)}│
  │  Google Workspace                    │
  │                                     │
  │  https://antidrift.io               │
  │  github.com/probeo-io/antidrift     │
  │  MIT License                        │
  └─────────────────────────────────────┘
`);


    console.log('');
  console.log('  ⚠ By installing this connector, you acknowledge that data accessed');
  console.log('  through it will be sent to your AI model provider (Anthropic, OpenAI,');
  console.log('  Google, etc.) as part of your conversation. Press Ctrl+C to cancel.');
  console.log('');

  const tokenPath = join(credsDir, 'token.json');
  if (existsSync(tokenPath)) {
    console.log('  Already authorized — updating server files.\n');
    await writeMcpConfig();
    console.log('  ✓ Google updated. Restart your agent to pick up changes.\n');
    process.exit(0);
  }

  const { runAuthFlow } = await import('../auth-google.mjs');
  await runAuthFlow();

  await writeMcpConfig();
  console.log('  ✓ Google connected (Sheets, Docs, Drive, Gmail, Calendar)');

  console.log('  Restart your agent to use it.\n');
  process.exit(0);
}

function status() {
  const hasToken = existsSync(join(credsDir, 'token.json'));
  const icon = hasToken ? '✓' : '○';
  console.log(`\n  ${icon} Google Workspace — ${hasToken ? 'connected' : 'not connected'}`);
  console.log('    Sheets, Docs, Drive, Gmail, Calendar\n');
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
    ? join(homedir(), '.antidrift', 'tools', 'google')
    : join(process.cwd(), '.mcp-servers', 'google');
  const pkgDir = join(__dirname, '..');

  mkdirSync(serverDir, { recursive: true });
  if (isGlobal) {
    for (const f of readdirSync(join(pkgDir, 'tools'))) {
      cpSync(join(pkgDir, 'tools', f), join(serverDir, f));
    }
    cpSync(join(pkgDir, 'lib', 'client.mjs'), join(serverDir, 'client.mjs'));
    cpSync(join(pkgDir, 'auth-google.mjs'), join(serverDir, 'auth-google.mjs'));
    writeFileSync(join(serverDir, 'package.json'), JSON.stringify({"type":"module","dependencies":{"googleapis":"*"}}));
    console.log('    Installing Google API dependencies...');
    execSync('npm install --silent', { cwd: serverDir, stdio: 'pipe' });
  } else {

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
  console.log('  Installing Google API dependencies...');
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
    zeroConfig.credentials['google'] = { file: join(homedir(), '.antidrift', 'google.json') };
    writeFileSync(zeroConfigPath, JSON.stringify(zeroConfig, null, 2));
    console.log('  ✓ Registered with global zeromcp (~/.antidrift/zeromcp.config.json)');
  } else {
    const mcpPath = join(process.cwd(), '.mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['antidrift-google'] = {
      command: 'node',
      args: [join('.mcp-servers', 'google', 'server.mjs')]
    };
    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Wrote .mcp.json (Claude Code)');
  }

  if (targets.cowork) {
    writeDesktopConfig('antidrift-google', serverPath);
    console.log('  ✓ Wrote claude_desktop_config.json (Claude Desktop)');
  }
}

main().catch(console.error).finally(() => process.exit(0));
