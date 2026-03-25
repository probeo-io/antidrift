#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
    mcpRedirect();
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
  npx @antidrift/core init              Start a new brain
  npx @antidrift/core join <repo>       Join an existing brain
  npx @antidrift/core update            Update core skills to latest
  npx @antidrift/core help              Show this message

Community skills:
  npx @antidrift/skills list            Browse community skills
  npx @antidrift/skills add <name>      Add a community skill to your brain

Connect services (type /connect inside Claude, or install directly):
  npx @antidrift/mcp-google             Google Sheets, Docs, Drive, Gmail, Calendar
  npx @antidrift/mcp-stripe             Stripe invoices, customers
  npx @antidrift/mcp-attio              Attio CRM
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
  console.log('  Created CLAUDE.md');

  // Step 6: Commit
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
          execSync('npm install @antidrift/mcp-google', { cwd: targetDir, stdio: 'pipe' });
          console.log('  Installed @antidrift/mcp-google');
          execSync('npx @antidrift/mcp-google', { cwd: targetDir, stdio: 'inherit' });
        } catch {
          console.log('  Skipped Google — run `npx @antidrift/mcp-google` later to set up.');
        }
      }

      if (pick === '2' || pick.toLowerCase().includes('stripe')) {
        console.log('');
        try {
          execSync('npm install @antidrift/mcp-stripe', { cwd: targetDir, stdio: 'pipe' });
          console.log('  Installed @antidrift/mcp-stripe');
          execSync('npx @antidrift/mcp-stripe', { cwd: targetDir, stdio: 'inherit' });
        } catch {
          console.log('  Skipped Stripe — run `npx @antidrift/mcp-stripe` later to set up.');
        }
      }

      if (pick === '3' || pick.toLowerCase().includes('attio')) {
        console.log('');
        try {
          execSync('npm install @antidrift/mcp-attio', { cwd: targetDir, stdio: 'pipe' });
          console.log('  Installed @antidrift/mcp-attio');
          execSync('npx @antidrift/mcp-attio', { cwd: targetDir, stdio: 'inherit' });
        } catch {
          console.log('  Skipped Attio — run `npx @antidrift/mcp-attio` later to set up.');
        }
      }
    }
  }

  // Launch
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
    console.log('  No .claude/skills/ found. Run `npx @antidrift/core init` first.');
    return;
  }

  installCoreSkills(skillsTarget);
  console.log('\n  Core skills updated. Browse extras with: npx @antidrift/skills list');
}

function mcpRedirect() {
  console.log(banner);
  console.log('  MCP connectors are separate packages. Install what you need:\n');
  console.log('    npx @antidrift/mcp-google     Google Workspace');
  console.log('    npx @antidrift/mcp-stripe     Stripe');
  console.log('    npx @antidrift/mcp-attio      Attio CRM\n');
  console.log('  Or type /connect inside Claude to set up interactively.\n');
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

function installCoreSkills(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const skills = readdirSync(coreSkillsSource);
  for (const skill of skills) {
    cpSync(join(coreSkillsSource, skill), join(targetDir, skill), { recursive: true });
  }
  console.log(`  Installed ${skills.length} core skills: ${skills.join(', ')}`);
}

main().catch(console.error);
