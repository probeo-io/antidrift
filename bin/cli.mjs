#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillsSource = join(__dirname, '..', 'skills');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise((resolve) => {
    rl.question(q, (answer) => {
      resolve(answer);
    });
  });
}

const banner = `
  ┌─────────────────────────────┐
  │  antidrift                  │
  │  Company brain for Claude   │
  └─────────────────────────────┘
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
    await mcp();
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

function showHelp() {
  console.log(`
antidrift — Company brain for Claude

Usage:
  npx antidrift init                Start a new brain (first person)
  npx antidrift join <repo>         Join an existing brain (everyone else)
  npx antidrift update              Update skills to latest version
  npx antidrift mcp add <service>   Connect a service (google-sheets, stripe)
  npx antidrift mcp list            Show connected services
  npx antidrift help                Show this message

Examples:
  npx antidrift init
  npx antidrift join mycompany/brain
  npx antidrift mcp add google-sheets
  npx antidrift mcp add stripe
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
    writeFileSync(join(targetDir, '.gitignore'), 'scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n');
    console.log('  Created .gitignore');
  }

  // Step 4: Skills
  const skillsTarget = join(targetDir, '.claude', 'skills');
  installSkills(skillsTarget);

  // Step 5: Create root CLAUDE.md
  const claudeMd = `# ${company.trim()} — Company Brain

## Getting Started
- \`/ingest <path>\` — Import files and directories into the brain
- \`/push\` — Save changes (commits locally, pushes if remote exists)
- \`/refresh\` — Pull latest changes from remote
- \`/remote\` — Set up GitHub so the team can share the brain
- Say **"I'm new here"** to get walked through everything

## How It Works
Each directory has a \`CLAUDE.md\` that Claude reads automatically. Add departments by creating directories with CLAUDE.md files. The brain grows as you use it.

## Departments

| Directory | What's In It |
|---|---|
| _Run /ingest to populate_ | |
`;
  writeFileSync(join(targetDir, 'CLAUDE.md'), claudeMd);
  console.log('  Created CLAUDE.md');

  // Step 6: Commit
  try {
    execSync('git add -A && git commit -m "Initial brain — antidrift"', {
      cwd: targetDir, stdio: 'pipe'
    });
    console.log('  Created initial commit');
  } catch { /* empty dir or already committed */ }

  // Step 6: Launch
  console.log('');
  const launch = await ask('  Launch Claude Code? (y/n) ');

  if (launch.trim().toLowerCase().startsWith('y')) {
    console.log('\n  Type /ingest to build your brain, or just start talking.\n');
    try {
      execSync('claude', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log(`\n  cd ${targetDir} && claude`);
    }
  } else {
    console.log(`
  Ready. Next steps:

    cd ${targetDir}
    claude

  Type /ingest to build your brain, or just start talking.
`);
  }
}

async function update() {
  console.log(banner);

  const skillsTarget = join(process.cwd(), '.claude', 'skills');

  if (!existsSync(skillsTarget)) {
    console.log('  No .claude/skills/ found. Run `npx antidrift init` first.');
    return;
  }

  installSkills(skillsTarget);
  console.log('\n  Skills updated to latest version.');
}

async function mcp() {
  console.log(banner);

  const subcommand = process.argv[3];
  const service = process.argv[4];

  if (subcommand === 'add') {
    await mcpAdd(service);
  } else if (subcommand === 'list') {
    mcpList();
  } else {
    console.log('  Usage:');
    console.log('    npx antidrift mcp add google-sheets');
    console.log('    npx antidrift mcp add stripe');
    console.log('    npx antidrift mcp list');
  }
}

async function mcpAdd(service) {
  const configDir = join(homedir(), '.antidrift');
  mkdirSync(configDir, { recursive: true });

  if (service === 'google-sheets') {
    // Check for credentials
    const credsPath = join(configDir, 'google-credentials.json');
    if (!existsSync(credsPath)) {
      console.log('  Google OAuth credentials not found.\n');
      console.log('  1. Go to https://console.cloud.google.com');
      console.log('  2. APIs & Services → Credentials → Create OAuth Client ID');
      console.log('  3. Application type: Desktop app');
      console.log('  4. Download the JSON file');
      console.log(`  5. Save it to: ${credsPath}\n`);
      console.log('  Then run this command again.');
      return;
    }

    // Run OAuth flow
    const { runAuthFlow } = await import('../mcp/auth-google.mjs');
    await runAuthFlow();

    // Write MCP config
    writeMcpConfig();
    console.log('  Google Sheets connected. Restart Claude Code to use it.');

  } else if (service === 'stripe') {
    const stripeConfigPath = join(configDir, 'stripe.json');
    const apiKey = await ask('  Stripe API key (sk_...): ');

    if (!apiKey.trim().startsWith('sk_')) {
      console.log('  Invalid key. Should start with sk_live_ or sk_test_');
      return;
    }

    writeFileSync(stripeConfigPath, JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
    console.log(`  Saved to ${stripeConfigPath}`);

    writeMcpConfig();
    console.log('  Stripe connected. Restart Claude Code to use it.');

  } else {
    console.log('  Available services: google-sheets, stripe');
  }
}

function mcpList() {
  const configDir = join(homedir(), '.antidrift');
  const services = [];

  if (existsSync(join(configDir, 'google-token.json'))) {
    services.push('google-sheets');
  }
  if (existsSync(join(configDir, 'stripe.json'))) {
    services.push('stripe');
  }

  if (services.length === 0) {
    console.log('  No services connected. Run: npx antidrift mcp add <service>');
  } else {
    console.log('  Connected services:\n');
    for (const s of services) {
      console.log(`    ✓ ${s}`);
    }
  }
}

function writeMcpConfig() {
  const mcpPath = join(process.cwd(), '.mcp.json');
  let config = {};

  if (existsSync(mcpPath)) {
    try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers.antidrift = {
    command: 'node',
    args: [join(__dirname, '..', 'mcp', 'server.mjs')]
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2));
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

  const skillsDir = join(targetDir, '.claude', 'skills');
  if (!existsSync(skillsDir)) {
    console.log('\n  No skills found. Installing core skills...');
    installSkills(skillsDir);
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

function installSkills(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const skills = readdirSync(skillsSource);
  for (const skill of skills) {
    cpSync(join(skillsSource, skill), join(targetDir, skill), { recursive: true });
  }
  console.log(`  Installed ${skills.length} skills: ${skills.join(', ')}`);
}

main().catch(console.error);
