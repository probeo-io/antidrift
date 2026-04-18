#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { syncBrainFiles } from '../lib/sync.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const coreSkillsSource = join(__dirname, '..', 'skills');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise((resolve) => {
    rl.question(q, (answer) => {
      resolve(answer);
    });
  });
}

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const ver = pkg.version;

// Detect if CLI is globally installed
let hasCli = false;
try { execSync('which antidrift', { stdio: 'ignore' }); hasCli = true; } catch {}
const CMD = hasCli ? 'antidrift' : 'npx @antidrift/core';
const cliTip = hasCli ? '' : '\n  Tip: npm install -g @antidrift/cli for easier commands\n';
const banner = `
  ┌─────────────────────────────────────┐
  │  antidrift v${ver.padEnd(24)}│
  │  AI agents and you                  │
  │                                     │
  │  https://antidrift.io               │
  │  github.com/probeo-io/antidrift     │
  │  MIT License                        │
  └─────────────────────────────────────┘${cliTip}
`;

async function main() {
  const command = process.argv[2];

  if (!command || command === 'help') {
    showHelp();
    rl.close();
    return;
  }

  const missing = checkPrereqs();
  if (missing.length > 0) {
    console.log(banner);
    console.log('  Missing prerequisites:\n');
    for (const m of missing) {
      console.log(`    ✗ ${m.name}`);
      console.log(`      ${m.install}\n`);
    }
    rl.close();
    process.exit(1);
  }

  if (command === 'init') {
    await init();
  } else if (command === 'join') {
    await joinBrain();
  } else if (command === 'update') {
    await update();
  } else if (command === 'mcp') {
    mcpRedirect();
  } else if (command === 'cross-compile') {
    crossCompileCommand();
  } else {
    console.log(`  Unknown command: ${command}\n`);
    showHelp();
  }

  rl.close();
}

function checkPrereqs() {
  const missing = [];
  const p = process.platform;

  try { execSync('git --version', { stdio: 'ignore' }); }
  catch {
    const install = p === 'darwin'
      ? 'Run: xcode-select --install\n             Or: brew install git'
      : p === 'win32'
        ? 'Download: https://git-scm.com/download/win\n             Or: winget install Git.Git'
        : 'Run: sudo apt install git\n             Or: sudo dnf install git';
    missing.push({ name: 'git', install });
  }

  try { execSync('which claude', { stdio: 'ignore' }); }
  catch {
    const install = p === 'darwin'
      ? 'Run: brew install claude-code\n             Or: npm install -g @anthropic-ai/claude-code'
      : 'Run: npm install -g @anthropic-ai/claude-code';
    missing.push({ name: 'Claude Code', install });
  }

  return missing;
}

async function crossCompileCommand() {
  const args = process.argv.slice(3);

  // Parse flags
  let from = 'auto';
  let to = null;
  let skillPath = null;
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { from = args[++i]; }
    else if (args[i] === '--to' && args[i + 1]) { to = args[++i]; }
    else if (args[i] === '--output' && args[i + 1]) { outputPath = args[++i]; }
    else if (!skillPath) { skillPath = args[i]; }
  }

  if (!skillPath || !to) {
    console.log(`
  Usage:
    antidrift cross-compile <skill-path> --to <claude|codex> [--from <claude|codex|auto>] [--output <dir>]

  Examples:
    antidrift cross-compile ./my-skill --to codex
    antidrift cross-compile ./my-skill --from codex --to claude --output ./output/
    antidrift cross-compile .claude/skills/ingest --to codex --output .agents/skills/
`);
    return;
  }

  if (!outputPath) {
    outputPath = to === 'claude' ? '.claude/skills' : '.agents/skills';
  }

  if (!existsSync(skillPath)) {
    console.log(`  Error: ${skillPath} does not exist.`);
    process.exit(1);
  }

  try {
    const { crossCompile } = await import('../lib/compiler.mjs');
    const { ir, outputPath: compiled, warnings } = crossCompile(skillPath, from, to, outputPath);

    console.log(`\n  Compiled: ${ir.name}`);
    console.log(`  From: ${ir.source || from} → To: ${to}`);
    console.log(`  Output: ${compiled}`);

    if (warnings.length > 0) {
      console.log(`\n  Warnings:`);
      for (const w of warnings) {
        console.log(`    ⚠ ${w}`);
      }
    }

    console.log('');
  } catch (err) {
    console.log(`  Error: ${err.message}`);
    process.exit(1);
  }
}

function showHelp() {
  const s = hasCli ? 'antidrift skills' : 'npx @antidrift/skills';
  console.log(`
antidrift — AI agents and you

Usage:
  ${CMD} init              Start a new brain
  ${CMD} join <repo>       Join an existing brain
  ${CMD} update            Update core skills + sync brain files

  ${s} list            Browse community skills
  ${s} add <name|pack> Add skills

  ${CMD} cross-compile <path> --to <claude|codex>

Connect services:
  ${hasCli ? 'antidrift' : 'npx @antidrift/cli'} connect google      Google Workspace
  ${hasCli ? 'antidrift' : 'npx @antidrift/cli'} connect stripe      Stripe
  ${hasCli ? 'antidrift' : 'npx @antidrift/cli'} connect attio       Attio CRM
  ${hasCli ? 'antidrift' : 'npx @antidrift/cli'} connect github      GitHub
${hasCli ? '' : '\nTip: npm install -g @antidrift/cli for shorter commands\n'}
https://antidrift.io
`);
}

async function init() {
  console.log(banner);

  const company = await ask('  Company name: ');
  const dirName = company.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/,'') || 'company-brain';
  const targetDir = join(process.cwd(), dirName);

  if (existsSync(targetDir)) {
    console.log(`\n  ${dirName}/ already exists.`);
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  console.log(`  Created ${dirName}/`);

  // Step 2: Git
  if (!existsSync(join(targetDir, '.git'))) {
    execSync('git init && git branch -m main', { cwd: targetDir, stdio: 'pipe' });
    console.log('  Initialized git repo');
  }

  // Step 3: Gitignore
  if (!existsSync(join(targetDir, '.gitignore'))) {
    writeFileSync(join(targetDir, '.gitignore'), 'scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n.claude/local.json\n.mcp.json\n.mcp-servers/\nnode_modules/\n');
    console.log('  Created .gitignore');
  }

  // Step 4: Core skills
  const skillsTarget = join(targetDir, '.claude', 'skills');
  installCoreSkills(skillsTarget);

  // Step 5: Create root CLAUDE.md
  const claudeMd = `# ${company.trim()} — Company Brain

## Getting Started
- \`/ingest <path>\` — Import files and directories into the brain
- \`/push\` — Save changes (commits locally, pushes if remote exists)
- \`/refresh\` — Pull latest changes from remote
- \`/remote\` — Set up GitHub so the team can share the brain
- \`/publish <skill>\` — Share a skill you built with the community
- Say **"I'm new here"** to get walked through everything

## How It Works
Each directory has a \`CLAUDE.md\` that Claude reads automatically. Add departments by creating directories with CLAUDE.md files. The brain grows as you use it.

## Departments

| Directory | What's In It |
|---|---|
| _Run /ingest to populate_ | |
`;
  writeFileSync(join(targetDir, 'CLAUDE.md'), claudeMd);
  writeFileSync(join(targetDir, 'AGENTS.md'), claudeMd);
  writeFileSync(join(targetDir, 'GEMINI.md'), claudeMd);
  console.log('  Created CLAUDE.md + AGENTS.md + GEMINI.md');

  // Step 6: zeromcp server
  installZeroMcp();

  // Step 7: Commit
  try {
    execSync('git add -A && git commit -m "Initial brain — antidrift"', {
      cwd: targetDir, stdio: 'pipe'
    });
    console.log('  Created initial commit');
  } catch { /* empty dir or already committed */ }

  // Connect services
  console.log('\n  Connect services (optional):\n');
  console.log('    1. Google Workspace (Sheets, Docs, Drive, Gmail, Calendar)');
  console.log('    2. Stripe (invoices, customers, products)');
  console.log('    3. Attio CRM (people, companies, deals)');
  console.log('');
  const services = await ask('  Which services? (e.g. 1,3 or "none"): ');

  if (services.trim().toLowerCase() !== 'none' && services.trim() !== '') {
    const picks = services.split(',').map(s => s.trim());

    for (const pick of picks) {
      if (pick === '1' || pick.toLowerCase().includes('google')) {
        console.log('');
        try {
          execSync('npx --yes @antidrift/mcp-google@latest -g', { stdio: 'inherit' });
        } catch {
          console.log('  Skipped Google — run `antidrift connect google -g` later to set up.');
        }
      }

      if (pick === '2' || pick.toLowerCase().includes('stripe')) {
        console.log('');
        try {
          execSync('npx --yes @antidrift/mcp-stripe@latest -g', { stdio: 'inherit' });
        } catch {
          console.log('  Skipped Stripe — run `antidrift connect stripe -g` later to set up.');
        }
      }

      if (pick === '3' || pick.toLowerCase().includes('attio')) {
        console.log('');
        try {
          execSync('npx --yes @antidrift/mcp-attio@latest -g', { stdio: 'inherit' });
        } catch {
          console.log('  Skipped Attio — run `antidrift connect attio -g` later to set up.');
        }
      }
    }
  }

  // Done
  try {
    process.chdir(targetDir);
  } catch {}

  console.log(`
  ✓ Brain created at ${dirName}/

  What to do now:

  1. Start your agent in this directory (claude, codex, etc.)

  2. Import your company knowledge:
     /ingest ~/Documents/company-docs
     /ingest ~/Projects/my-app

  3. Browse skills:
     antidrift skills list

  4. Connect applications:
     antidrift connect list

  Your brain grows as you use it. The more you ingest, the smarter
  your agent gets about your company.

  https://antidrift.io
`);
}

async function update() {
  console.log(banner);
  console.log('  Updating brain...\n');

  const cwd = process.cwd();
  const skillsTarget = join(cwd, '.claude', 'skills');

  if (!existsSync(skillsTarget)) {
    console.log('  No .claude/skills/ found in ' + cwd);
    console.log('  Run `antidrift init` first (or `npx @antidrift/core init`).\n');
    return;
  }

  // Step 1: Core skills
  console.log('  Step 1: Core skills');
  installCoreSkills(skillsTarget);

  // Step 2: Compile community skills
  console.log('  Step 2: Community skills');
  try {
    await compileInstalledSkills(skillsTarget);
  } catch (err) {
    console.log(`  ⚠ Compile error: ${err.message}`);
  }

  // Step 3: Sync brain files
  console.log('  Step 3: Sync brain files');
  const { synced } = syncBrainFiles(cwd);
  if (synced > 0) {
    console.log(`    Synced ${synced} brain file(s) (CLAUDE.md ↔ AGENTS.md ↔ GEMINI.md)`);
  } else {
    console.log('    All brain files in sync');
  }

  // Step 4: zeromcp server
  console.log('  Step 4: zeromcp server');
  installZeroMcp();

  // Step 5: MCP connectors — migrate old entries + update all installed
  console.log('  Step 5: Connectors');
  await migrateAndUpdateConnectors();

  console.log('\n  ✓ Brain updated.');
  console.log('  Browse community skills: antidrift skills list\n');
}

// Map of service name → credential file (relative to ~/.antidrift/)
const CONNECTOR_CRED = {
  github:              'github.json',
  linear:              'linear.json',
  attio:               'attio.json',
  clickup:             'clickup.json',
  cloudflare:          'cloudflare.json',
  vercel:              'vercel.json',
  netlify:             'netlify.json',
  pipedrive:           'pipedrive.json',
  'hubspot-crm':       'hubspot.json',
  'hubspot-marketing': 'hubspot.json',
  jira:                'jira.json',
  notion:              'notion.json',
  stripe:              'stripe.json',
  aws:                 'aws.json',
  'aws-s3':            'aws-s3.json',
  'aws-spot':          'aws-spot.json',
  calendar:            join('credentials', 'google', 'token.json'),
  drive:               join('credentials', 'google', 'token.json'),
  gmail:               join('credentials', 'google', 'token.json'),
  google:              join('credentials', 'google', 'token.json'),
};

async function migrateAndUpdateConnectors() {
  const antidriftDir = join(homedir(), '.antidrift');
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  const zeroConfigPath = join(antidriftDir, 'zeromcp.config.json');
  const localMcpPath = join(process.cwd(), '.mcp.json');

  // Collect connector names from zeromcp.config.json
  let zeroConfig = { tools: [], credentials: {} };
  if (existsSync(zeroConfigPath)) {
    try { zeroConfig = JSON.parse(readFileSync(zeroConfigPath, 'utf8')); } catch {}
  }
  const zeromcpNames = new Set(Object.keys(zeroConfig.credentials || {}));

  // Collect old-style entries from ~/.claude/settings.json
  let globalSettings = {};
  if (existsSync(settingsPath)) {
    try { globalSettings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
  }
  const oldGlobal = Object.keys(globalSettings.mcpServers || {})
    .filter(k => k.startsWith('antidrift-') && k !== 'antidrift-zeromcp-server')
    .map(k => k.replace(/^antidrift-/, ''));

  // Collect old-style entries from .mcp.json (project-local)
  let localConfig = {};
  if (existsSync(localMcpPath)) {
    try { localConfig = JSON.parse(readFileSync(localMcpPath, 'utf8')); } catch {}
  }
  const oldLocal = Object.keys(localConfig.mcpServers || {})
    .filter(k => k.startsWith('antidrift-'))
    .map(k => k.replace(/^antidrift-/, ''));

  // Union all detected connector names
  const detected = new Set([...zeromcpNames, ...oldGlobal, ...oldLocal]);

  // Filter to connectors that actually have credentials
  const toUpdate = [...detected].filter(name => {
    const credFile = CONNECTOR_CRED[name];
    return credFile && existsSync(join(antidriftDir, credFile));
  });

  if (toUpdate.length === 0 && detected.size === 0) {
    console.log('    No connectors installed');
  } else {
    // Migrate / update each connector
    for (const name of toUpdate) {
      try {
        execSync(`npx --yes @antidrift/mcp-${name}@latest -g`, { stdio: 'pipe' });
        const tag = zeromcpNames.has(name) ? 'updated' : 'migrated';
        console.log(`    ✓ ${name} ${tag}`);
      } catch {
        console.log(`    ⚠ ${name} update failed`);
      }
    }

    // Remove old individual entries from ~/.claude/settings.json
    let removedGlobal = 0;
    for (const name of oldGlobal) {
      if (globalSettings.mcpServers?.[`antidrift-${name}`]) {
        delete globalSettings.mcpServers[`antidrift-${name}`];
        removedGlobal++;
      }
    }
    if (removedGlobal > 0) {
      writeFileSync(settingsPath, JSON.stringify(globalSettings, null, 2));
      console.log(`    Removed ${removedGlobal} old server entry(s) from ~/.claude/settings.json`);
    }

    // Remove old entries from .mcp.json
    let removedLocal = 0;
    for (const name of oldLocal) {
      if (localConfig.mcpServers?.[`antidrift-${name}`]) {
        delete localConfig.mcpServers[`antidrift-${name}`];
        removedLocal++;
      }
    }
    if (removedLocal > 0) {
      writeFileSync(localMcpPath, JSON.stringify(localConfig, null, 2));
      console.log(`    Removed ${removedLocal} old server entry(s) from .mcp.json`);
    }
  }

  // Print status table for all 20 connectors
  console.log('');
  console.log('    Connectors:');
  for (const [name, credFile] of Object.entries(CONNECTOR_CRED)) {
    const connected = existsSync(join(antidriftDir, credFile));
    const icon = connected ? '✓' : '○';
    console.log(`      ${icon} ${name}`);
  }
  console.log('');
}

async function compileInstalledSkills(skillsDir) {
  const { parseIR, compileToClaude, compileToCodex } = await import('../lib/compiler.mjs');

  let entries;
  try { entries = readdirSync(skillsDir); } catch { return; }

  // Detect all installed platforms
  const platforms = [];
  try { execSync('which claude', { stdio: 'ignore' }); platforms.push('claude'); } catch {}
  try { execSync('which codex', { stdio: 'ignore' }); platforms.push('codex'); } catch {}
  if (platforms.length === 0) platforms.push('claude'); // default

  let compiled = 0;

  for (const entry of entries) {
    const skillDir = join(skillsDir, entry);
    try {
      if (!statSync(skillDir).isDirectory()) continue;
    } catch { continue; }

    const irPath = join(skillDir, 'skill.ir.yaml');
    if (!existsSync(irPath)) continue;

    const irContent = readFileSync(irPath, 'utf8');
    const ir = parseIR(irContent);

    // Compile for all detected platforms
    if (platforms.includes('claude')) {
      compileToClaude(ir, skillsDir);
    }
    if (platforms.includes('codex')) {
      const codexTarget = join(process.cwd(), '.agents', 'skills');
      mkdirSync(codexTarget, { recursive: true });
      compileToCodex(ir, codexTarget);
    }

    compiled++;
  }

  if (compiled > 0) {
    console.log(`    Compiled ${compiled} community skill(s) for ${platforms.join(' + ')}`);
  } else {
    console.log('    No community skills to compile');
  }
}

function mcpRedirect() {
  console.log(banner);
  console.log('  Connect services:\n');
  const c = hasCli ? 'antidrift connect' : 'npx @antidrift/cli connect';
  console.log(`    ${c} google      Google Workspace`);
  console.log(`    ${c} stripe      Stripe`);
  console.log(`    ${c} attio       Attio CRM`);
  console.log(`    ${c} github      GitHub\n`);
}

async function joinBrain() {
  console.log(banner);

  let repo = process.argv[3];
  if (!repo) {
    repo = await ask('  Brain repo (org/name or URL): ');
  }
  repo = repo.trim();

  if (!repo) {
    console.log('  No repo provided.');
    return;
  }

  const repoName = basename(repo.replace(/\.git$/, ''));
  const targetDir = join(process.cwd(), repoName);

  if (existsSync(targetDir)) {
    console.log(`  ${repoName}/ exists. Pulling latest...\n`);
    try {
      execSync('git pull --ff-only origin main', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log('  Pull failed — may need to resolve conflicts.');
    }
  } else {
    console.log(`  Cloning ${repo}...\n`);
    try {
      const url = repo.includes('://') || repo.includes('@')
        ? repo : `https://github.com/${repo}.git`;
      execSync(`git clone ${url}`, { cwd: process.cwd(), stdio: 'inherit' });
    } catch {
      console.log('\n  Clone failed. Check the URL and your access.');
      return;
    }
  }

  // Write brain.json with repo info
  const repoSlug = repo.includes('://') || repo.includes('@')
    ? repo.replace(/.*github\.com[:/]/, '').replace(/\.git$/, '')
    : repo.replace(/\.git$/, '');
  const claudeDir = join(targetDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, 'brain.json'), JSON.stringify({ repo: repoSlug }, null, 2) + '\n');
  console.log('  Saved brain config');

  const skillsDir = join(targetDir, '.claude', 'skills');
  if (!existsSync(skillsDir)) {
    console.log('\n  No skills found. Installing core skills...');
    installCoreSkills(join(targetDir, '.claude', 'skills'));
  } else {
    const skills = readdirSync(skillsDir);
    console.log(`\n  Found ${skills.length} skills: ${skills.join(', ')}`);
  }

  console.log('');
  const launch = await ask('  Open Claude Code? (y/n) ');

  if (launch.trim().toLowerCase().startsWith('y')) {
    console.log('\n  Say "I\'m new here" to get started.\n');
    try {
      execSync('claude', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log(`\n  cd ${repoName} && claude`);
    }
  } else {
    console.log(`
  Ready:

    cd ${repoName}
    claude

  Say "I'm new here" to get walked through everything.
`);
  }
}

function installZeroMcp() {
  const antidriftDir = join(homedir(), '.antidrift');
  const serverDir = join(antidriftDir, 'mcp-server');
  const zeroConfigPath = join(antidriftDir, 'zeromcp.config.json');
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  // Check if already registered globally
  let settings = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
  }
  if (settings.mcpServers?.['antidrift-zeromcp-server']) {
    console.log('    zeromcp already installed globally');
    return;
  }

  // Install zeromcp to ~/.antidrift/mcp-server/
  mkdirSync(serverDir, { recursive: true });
  writeFileSync(join(serverDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));
  console.log('    Installing zeromcp...');
  execSync('npm install @antidrift/zeromcp@latest --silent', { cwd: serverDir, stdio: 'pipe' });

  // Create ~/.antidrift/zeromcp.config.json if it doesn't exist
  if (!existsSync(zeroConfigPath)) {
    const toolsRoot = join(antidriftDir, 'tools');
    writeFileSync(zeroConfigPath, JSON.stringify({ tools: [toolsRoot], credentials: {} }, null, 2));
  }

  // Register in ~/.claude/settings.json with --config pointing to zeromcp.config.json
  const serverBin = join(serverDir, 'node_modules', '@antidrift', 'zeromcp', 'bin', 'mcp.js');
  mkdirSync(dirname(settingsPath), { recursive: true });
  if (!settings.mcpServers) settings.mcpServers = {};
  settings.mcpServers['antidrift-zeromcp-server'] = {
    command: 'node',
    args: [serverBin, 'serve', '--config', zeroConfigPath]
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  ✓ Installed zeromcp to ~/.antidrift/mcp-server/');
  console.log('  ✓ Registered antidrift-zeromcp-server in ~/.claude/settings.json');
}

function installCoreSkills(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const skills = readdirSync(coreSkillsSource);
  for (const skill of skills) {
    cpSync(join(coreSkillsSource, skill), join(targetDir, skill), { recursive: true });
  }
  console.log(`  Installed ${skills.length} core skills: ${skills.join(', ')}`);
}

main().catch(console.error);
