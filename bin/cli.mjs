#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
  npx antidrift init            Start a new brain (first person)
  npx antidrift join <repo>     Join an existing brain (everyone else)
  npx antidrift help            Show this message

Examples:
  npx antidrift init
  npx antidrift join mycompany/brain
  npx antidrift join https://github.com/mycompany/brain.git
`);
}

async function init() {
  console.log(banner);

  // Step 1: Where?
  const here = await ask('  Install in current directory? (y/n) ');
  let targetDir;

  if (here.trim().toLowerCase().startsWith('y')) {
    targetDir = process.cwd();
  } else {
    const dirName = await ask('  Directory name (e.g. company-brain): ');
    const name = dirName.trim() || 'company-brain';
    targetDir = join(process.cwd(), name);

    if (existsSync(targetDir)) {
      console.log(`\n  ${name}/ already exists.`);
      return;
    }

    mkdirSync(targetDir, { recursive: true });
    console.log(`\n  Created ${name}/`);
  }

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

  // Step 5: Commit
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
    console.log('\n  Type /init to build your brain, or just start talking.\n');
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

  Type /init to build your brain, or just start talking.
`);
  }
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
