#!/usr/bin/env node

import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
antidrift — AI agents and you

Usage:
  antidrift init                          Start a new brain
  antidrift join <repo>                   Join an existing brain
  antidrift update                        Update core skills + sync brain files

  antidrift skills list                   Browse community skills (by pack)
  antidrift skills add <name|pack>        Add skills (essentials, engineering, customer-research, legal, security)
  antidrift skills add --all              Add all community skills
  antidrift skills remove <name>          Remove a skill

  antidrift cross-compile <path> --to <claude|codex>

  antidrift connect google                Connect Google Workspace (Claude Code)
  antidrift connect google --cowork       Connect to Claude Desktop / Cowork
  antidrift connect google --all          Connect to all detected platforms
  antidrift connect attio                 Connect Attio CRM
  antidrift connect attio --cowork        Connect to Claude Desktop / Cowork
  antidrift connect attio --all           Connect to all detected platforms
  antidrift connect stripe                Connect Stripe
  antidrift connect stripe --cowork       Connect to Claude Desktop / Cowork
  antidrift connect stripe --all          Connect to all detected platforms
  antidrift connect github                Connect GitHub
  antidrift connect github --cowork       Connect to Claude Desktop / Cowork
  antidrift connect github --all          Connect to all detected platforms

  antidrift version                       Show version
  antidrift help                          Show this message

  https://antidrift.io
  Built by Probeo.io
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
} else if (command === 'connect') {
  const service = args[1];
  const mcpPackages = {
    google: '@antidrift/mcp-google',
    attio: '@antidrift/mcp-attio',
    stripe: '@antidrift/mcp-stripe',
    github: '@antidrift/mcp-github',
  };
  if (service && mcpPackages[service]) {
    run(`npx --yes ${mcpPackages[service]}@latest ${args.slice(2).join(' ')}`);
  } else {
    console.log('\n  Available services:\n');
    console.log('    antidrift connect google    Google Workspace (Sheets, Docs, Drive, Gmail, Calendar)');
    console.log('    antidrift connect attio     Attio CRM (people, companies, deals, tasks, notes)');
    console.log('    antidrift connect stripe    Stripe (customers, invoices, subscriptions, charges)');
    console.log('    antidrift connect github    GitHub (repos, issues, PRs, actions, releases)\n');
  }
} else if (command === 'init' || command === 'join' || command === 'update' || command === 'cross-compile' || command === 'mcp') {
  npxCore(args.join(' '));
} else {
  // Unknown command — try core, it'll show its own help if invalid
  npxCore(args.join(' '));
}
