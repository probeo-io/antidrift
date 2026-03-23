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
      console.log(`    ✗ ${m.name} — ${m.help}`);
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

  // git is required for both init and join
  try { execSync('git --version', { stdio: 'ignore' }); }
  catch { missing.push({ name: 'git', help: 'https://git-scm.com/downloads' }); }

  // claude is required for both
  try { execSync('which claude', { stdio: 'ignore' }); }
  catch { missing.push({ name: 'Claude Code', help: 'https://docs.anthropic.com/en/docs/claude-code' }); }

  // gh is nice to have for join but not required
  if (command === 'join') {
    try { execSync('gh --version', { stdio: 'ignore' }); }
    catch { /* git clone still works without gh */ }
  }

  return missing;
}

function showHelp() {
  console.log(`
antidrift — Company brain skills for Claude Code

Usage:
  npx antidrift init     Start a new brain (first person)
  npx antidrift join     Join an existing brain (everyone else)
  npx antidrift help     Show this message
`);
}

async function init() {
  console.log(banner);

  const targetDir = process.cwd();
  const skillsTarget = join(targetDir, '.claude', 'skills');

  // Install skills
  if (existsSync(skillsTarget)) {
    const existing = readdirSync(skillsTarget);
    if (existing.length > 0) {
      const overwrite = await ask(`  Skills already exist (${existing.join(', ')})\n  Overwrite core skills? (y/n) `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log('  Skipping skill install.\n');
      } else {
        installSkills(skillsTarget);
      }
    } else {
      installSkills(skillsTarget);
    }
  } else {
    installSkills(skillsTarget);
  }

  // Init git if needed
  if (!existsSync(join(targetDir, '.git'))) {
    console.log('');
    const initGit = await ask('  Initialize git repo? (y/n) ');
    if (initGit.toLowerCase() === 'y') {
      execSync('git init && git branch -m main', { cwd: targetDir, stdio: 'inherit' });
    }
  }

  // Add gitignore if missing
  if (!existsSync(join(targetDir, '.gitignore'))) {
    writeFileSync(join(targetDir, '.gitignore'), 'scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n');
    console.log('  Created .gitignore');
  }

  // Build brain?
  console.log('');
  const buildBrain = await ask('  Build a brain now? Claude will walk you through it. (y/n) ');

  if (buildBrain.toLowerCase() === 'y') {
    console.log('\n  Launching Claude Code...\n');
    try {
      execSync('claude', { cwd: targetDir, stdio: 'inherit' });
    } catch {
      console.log('\n  Open Claude Code in this directory and type /init');
    }
  } else {
    showNextSteps(targetDir);
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
      console.log(`\n  cd ${targetDir} && claude`);
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

function showNextSteps(targetDir) {
  console.log(`
  Skills installed. To get started:

    cd ${targetDir}
    claude

  Then type /init to build your brain, or just start adding CLAUDE.md files.

  Available commands:
    /init      — Build a brain from scratch or migrate existing knowledge
    /refresh   — Pull latest changes
    /push      — Commit and push changes

  Say "I'm new here" to get a walkthrough.
`);
}

main().catch(console.error);
