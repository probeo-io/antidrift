#!/usr/bin/env node

import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
antidrift — Company brain for AI coding agents

Usage:
  antidrift init                          Start a new brain
  antidrift join <repo>                   Join an existing brain
  antidrift update                        Update core skills + sync brain files

  antidrift skills list                   Browse community skills (by pack)
  antidrift skills add <name|pack>        Add skills (essentials, engineering, customer-research, legal)
  antidrift skills add --all              Add all community skills
  antidrift skills remove <name>          Remove a skill

  antidrift cross-compile <path> --to <claude|codex>

  antidrift version                       Show version
  antidrift help                          Show this message

Install:
  npm install -g antidrift
  pip install antidrift
`;

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

function npxCore(subArgs) {
  run(`npx --yes @antidrift/core@latest ${subArgs}`);
}

function npxSkills(subArgs) {
  run(`npx --yes @antidrift/skills@latest ${subArgs}`);
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(HELP);
  process.exit(0);
}

if (command === 'version' || command === '--version' || command === '-v') {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(`antidrift ${pkg.version}`);
  process.exit(0);
}

// Route to the right package
if (command === 'skills') {
  const subArgs = args.slice(1).join(' ');
  if (!subArgs) {
    npxSkills('list');
  } else {
    npxSkills(subArgs);
  }
} else if (command === 'init' || command === 'join' || command === 'update' || command === 'cross-compile' || command === 'mcp') {
  npxCore(args.join(' '));
} else {
  // Unknown command — try core, it'll show its own help if invalid
  npxCore(args.join(' '));
}
