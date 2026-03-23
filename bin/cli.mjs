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
const ask = (q) => new Promise((r) => rl.question(q, r));

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

  // Check prerequisites
  const missing = checkPrereqs(command);
  if (missing.length > 0) {
    console.log(banner);
    console.log('  Missing prerequisites:\n');
    for (const m of missing) {
      console.log(`    ✗ ${m.name}`);
      console.log(`      ${m.install}\n`);
    }
    console.log('');
    rl.close();
    process.exit(1);
  }

  if (command === 'init') {
    await init();
  } else if (command === 'join') {
    await join_brain();
  } else {
    console.log(`  Unknown command: ${command}\n`);
    showHelp();
  }

  rl.close();
}

function checkPrereqs(command) {
  const missing = [];
  const platform = process.platform;

  try { execSync('git --version', { stdio: 'ignore' }); }
  catch { missing.push({ name: 'git', install: gitInstall(platform) }); }

  try { execSync('which claude', { stdio: 'ignore' }); }
  catch { missing.push({ name: 'Claude Code', install: claudeInstall(platform) }); }

  return missing;
}

function gitInstall(platform) {
  if (platform === 'darwin') {
    return 'Run: xcode-select --install\n             Or: brew install git';
  } else if (platform === 'win32') {
    return 'Download: https://git-scm.com/download/win\n             Or: winget install Git.Git';
  } else {
    return 'Run: sudo apt install git\n             Or: sudo dnf install git';
  }
}

function claudeInstall(platform) {
  if (platform === 'darwin') {
    return 'Run: brew install claude-code\n             Or: npm install -g @anthropic-ai/claude-code';
  } else if (platform === 'win32') {
    return 'Run: npm install -g @anthropic-ai/claude-code';
  } else {
    return 'Run: npm install -g @anthropic-ai/claude-code';
  }
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

  // Step 1: Name the brain
  const brainName = await ask('  What should the brain be called? (e.g. company-brain): ');
  const name = brainName.trim() || 'company-brain';
  const targetDir = join(process.cwd(), name);

  if (existsSync(targetDir)) {
    console.log(`\n  ${name}/ already exists. Run from inside it or pick a different name.`);
    return;
  }

  // Step 2: Create directory
  mkdirSync(targetDir, { recursive: true });
  console.log(`\n  Created ${name}/`);

  // Step 3: Git init
  execSync('git init && git branch -m main', { cwd: targetDir, stdio: 'pipe' });
  console.log('  Initialized git repo');

  // Step 4: Gitignore
  writeFileSync(join(targetDir, '.gitignore'), 'scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n');
  console.log('  Created .gitignore');

  // Step 5: Install skills
  const skillsTarget = join(targetDir, '.claude', 'skills');
  installSkills(skillsTarget);

  // Step 6: Initial commit
  try {
    execSync('git add -A && git commit -m "Initial brain — antidrift"', {
      cwd: targetDir,
      stdio: 'pipe'
    });
    console.log('  Created initial commit');
  } catch {
    // Commit failed, that's ok
  }

  // Step 8: Launch Claude
  console.log('');
  const launch = await ask('  Launch Claude Code to build the brain? (y/n) ');

  if (launch.toLowerCase() === 'y') {
    console.log(`\n  Launching Claude Code in ${name}/...`);
    console.log('  Type /init to build your brain, or just start talking.\n');
    try {
      execSync('claude', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log(`\n  cd ${name} && claude`);
    }
  } else {
    console.log(`
  Ready. Next steps:

    cd ${name}
    claude

  Then type /init to build your brain, or just start talking.
  Share with your team: npx antidrift join <org>/${name}
`);
  }
}

async function join_brain() {
  console.log(banner);

  // Get repo URL
  let repo = process.argv[3];
  if (!repo) {
    repo = await ask('  Brain repo URL or org/name (e.g. mycompany/brain): ');
  }
  repo = repo.trim();

  if (!repo) {
    console.log('  No repo provided. Exiting.');
    return;
  }

  // Figure out clone target
  const repoName = basename(repo.replace(/\.git$/, ''));
  const targetDir = join(process.cwd(), repoName);

  if (existsSync(targetDir)) {
    console.log(`  ${repoName}/ already exists. Pulling latest...\n`);
    try {
      execSync('git pull --ff-only origin main', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log('  Pull failed — you may need to resolve conflicts.');
    }
  } else {
    // Clone
    console.log(`  Cloning ${repo}...\n`);
    try {
      const url = repo.includes('://') || repo.includes('@')
        ? repo
        : `https://github.com/${repo}.git`;
      execSync(`git clone ${url}`, { cwd: process.cwd(), stdio: 'inherit' });
    } catch {
      console.log(`\n  Clone failed. Check the repo URL and your access.`);
      return;
    }
  }

  // Check if skills exist
  const skillsDir = join(targetDir, '.claude', 'skills');
  if (!existsSync(skillsDir)) {
    console.log('\n  No skills found in repo. Installing core skills...');
    installSkills(skillsDir);
  } else {
    const skills = readdirSync(skillsDir);
    console.log(`\n  Found ${skills.length} skills: ${skills.join(', ')}`);
  }

  // Launch
  console.log('');
  const launch = await ask('  Open Claude Code? (y/n) ');

  if (launch.toLowerCase() === 'y') {
    console.log('\n  Launching Claude Code... Say "I\'m new here" to get started.\n');
    try {
      execSync('claude', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log(`\n  cd ${repoName} && claude`);
      console.log('  Then say "I\'m new here"');
    }
  } else {
    console.log(`
  Ready. To get started:

    cd ${repoName}
    claude

  Then say "I'm new here" and the brain will walk you through everything.
`);
  }
}

function installSkills(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const skills = readdirSync(skillsSource);
  for (const skill of skills) {
    const src = join(skillsSource, skill);
    const dest = join(targetDir, skill);
    cpSync(src, dest, { recursive: true });
  }
  console.log(`  Installed ${skills.length} skills: ${skills.join(', ')}`);
}

main().catch(console.error);
