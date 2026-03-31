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
  antidrift skills add all              Add all community skills
  antidrift skills remove <name>          Remove a skill

  antidrift cross-compile <path> --to <claude|codex>

  antidrift connect google                All Google (Sheets, Docs, Drive, Gmail, Calendar)
  antidrift connect gmail                 Gmail only
  antidrift connect drive                 Drive, Docs, Sheets
  antidrift connect calendar              Calendar only
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
  antidrift connect clickup               Connect ClickUp
  antidrift connect clickup --cowork      Connect to Claude Desktop / Cowork
  antidrift connect clickup --all         Connect to all detected platforms
  antidrift connect aws                   Connect AWS (S3, Lambda, ECS, Logs, SQS, Cost)
  antidrift connect aws --cowork          Connect to Claude Desktop / Cowork
  antidrift connect aws --all             Connect to all detected platforms
  antidrift connect jira                  Connect Jira
  antidrift connect jira --cowork         Connect to Claude Desktop / Cowork
  antidrift connect jira --all            Connect to all detected platforms
  antidrift connect notion                Connect Notion (read-only)
  antidrift connect notion --cowork       Connect to Claude Desktop / Cowork
  antidrift connect notion --all          Connect to all detected platforms
  antidrift connect hubspot-crm           Connect HubSpot CRM
  antidrift connect hubspot-crm --cowork  Connect to Claude Desktop / Cowork
  antidrift connect hubspot-crm --all     Connect to all detected platforms
  antidrift connect hubspot-marketing           Connect HubSpot Marketing
  antidrift connect hubspot-marketing --cowork  Connect to Claude Desktop / Cowork
  antidrift connect hubspot-marketing --all     Connect to all detected platforms
  antidrift connect linear                Connect Linear (issues, projects, cycles)
  antidrift connect linear --cowork       Connect to Claude Desktop / Cowork
  antidrift connect linear --all          Connect to all detected platforms

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
    gmail: '@antidrift/mcp-gmail',
    drive: '@antidrift/mcp-drive',
    calendar: '@antidrift/mcp-calendar',
    attio: '@antidrift/mcp-attio',
    stripe: '@antidrift/mcp-stripe',
    github: '@antidrift/mcp-github',
    clickup: '@antidrift/mcp-clickup',
    aws: '@antidrift/mcp-aws',
    jira: '@antidrift/mcp-jira',
    notion: '@antidrift/mcp-notion',
    'hubspot-crm': '@antidrift/mcp-hubspot-crm',
    'hubspot-marketing': '@antidrift/mcp-hubspot-marketing',
    linear: '@antidrift/mcp-linear',
  };
  if (service && mcpPackages[service]) {
    run(`npx --yes ${mcpPackages[service]}@latest ${args.slice(2).join(' ')}`);
  } else {
    console.log('\n  Available services:\n');
    console.log('    antidrift connect google    All Google (Sheets, Docs, Drive, Gmail, Calendar)');
    console.log('    antidrift connect gmail     Gmail only');
    console.log('    antidrift connect drive     Drive, Docs, Sheets');
    console.log('    antidrift connect calendar  Calendar only');
    console.log('    antidrift connect attio     Attio CRM (people, companies, deals, tasks, notes)');
    console.log('    antidrift connect stripe    Stripe (customers, invoices, subscriptions, charges)');
    console.log('    antidrift connect github    GitHub (repos, issues, PRs, actions, releases)');
    console.log('    antidrift connect clickup   ClickUp (workspaces, spaces, tasks, comments)');
    console.log('    antidrift connect aws       AWS (S3, Lambda, ECS, CloudWatch, SQS, Cost Explorer)');
    console.log('    antidrift connect jira      Jira (projects, issues, sprints, boards)');
    console.log('    antidrift connect notion    Notion (pages, databases, blocks — read-only)');
    console.log('    antidrift connect hubspot-crm  HubSpot CRM (contacts, companies, deals, notes)');
    console.log('    antidrift connect hubspot-marketing  HubSpot Marketing (emails, campaigns, forms, pages, blog)');
    console.log('    antidrift connect linear    Linear (issues, projects, cycles, teams, comments)\n');
  }
} else if (command === 'init' || command === 'join' || command === 'update' || command === 'cross-compile' || command === 'mcp') {
  npxCore(args.join(' '));
} else {
  // Unknown command — try core, it'll show its own help if invalid
  npxCore(args.join(' '));
}
