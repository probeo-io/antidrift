#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const REPO = 'probeo-io/antidrift-skills';

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || command === 'help') {
  showHelp();
} else if (command === 'list') {
  list();
} else if (command === 'add') {
  add(args);
} else if (command === 'remove') {
  remove(args);
} else {
  console.log(`  Unknown command: ${command}\n`);
  showHelp();
}

function showHelp() {
  console.log(`
@antidrift/skills — Community skills for Claude Code brains

Core skills ship with every brain via @antidrift/core.
This registry has community extras from github.com/${REPO}

Usage:
  npx @antidrift/skills list                 List community skills
  npx @antidrift/skills add <name...>        Add skills to current brain
  npx @antidrift/skills add --all            Add all community skills
  npx @antidrift/skills remove <name...>     Remove skills from current brain
  npx @antidrift/skills help                 Show this message
`);
}

function fetchRegistry() {
  try {
    const result = execSync(
      `gh api repos/${REPO}/git/trees/main --jq '.tree[] | select(.type=="tree") | .path'`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    console.log('  Could not fetch registry. Make sure gh is installed and authenticated.\n');
    process.exit(1);
  }
}

function fetchSkillMeta(name) {
  try {
    const content = execSync(
      `gh api repos/${REPO}/contents/${name}/SKILL.md --jq '.content' | base64 -d`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }
    );
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { name, description: '' };
    const frontmatter = match[1];
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
    return { name, description };
  } catch {
    return { name, description: '' };
  }
}

function getInstalledSkills() {
  const skillsDir = join(process.cwd(), '.claude', 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter(d =>
    existsSync(join(skillsDir, d, 'SKILL.md'))
  );
}

function list() {
  const available = fetchRegistry();
  const installed = new Set(getInstalledSkills());

  console.log('');
  for (const name of available) {
    const meta = fetchSkillMeta(name);
    const status = installed.has(name) ? '✓' : '○';
    console.log(`  ${status} ${meta.name.padEnd(12)} ${meta.description}`);
  }

  const installedCount = available.filter(n => installed.has(n)).length;
  console.log(`\n  ${installedCount}/${available.length} installed\n`);
}

function cloneRegistry() {
  const tmpDir = execSync('mktemp -d', { encoding: 'utf8' }).trim();
  execSync(`git clone --depth=1 https://github.com/${REPO}.git "${tmpDir}/registry"`, {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return join(tmpDir, 'registry');
}

function add(names) {
  if (names.length === 0) {
    console.log('  Usage: npx @antidrift/skills add <name...>');
    console.log('         npx @antidrift/skills add --all\n');
    return;
  }

  const available = fetchRegistry();
  const toInstall = names.includes('--all')
    ? available
    : names.filter(n => {
        if (!available.includes(n)) {
          console.log(`  ✗ "${n}" not found in registry`);
          return false;
        }
        return true;
      });

  if (toInstall.length === 0) return;

  const registryDir = cloneRegistry();
  const skillsTarget = join(process.cwd(), '.claude', 'skills');
  mkdirSync(skillsTarget, { recursive: true });

  for (const skill of toInstall) {
    const src = join(registryDir, skill);
    if (existsSync(src)) {
      cpSync(src, join(skillsTarget, skill), { recursive: true });
      console.log(`  ✓ ${skill}`);
    } else {
      console.log(`  ✗ ${skill} — not found in clone`);
    }
  }

  // Clean up
  rmSync(dirname(registryDir), { recursive: true, force: true });

  console.log(`\n  Added ${toInstall.length} skill${toInstall.length === 1 ? '' : 's'}. Restart Claude Code to pick them up.\n`);
}

function remove(names) {
  if (names.length === 0) {
    console.log('  Usage: npx @antidrift/skills remove <name...>\n');
    return;
  }

  const skillsDir = join(process.cwd(), '.claude', 'skills');
  for (const name of names) {
    const skillPath = join(skillsDir, name);
    if (!existsSync(skillPath)) {
      console.log(`  ✗ "${name}" not installed`);
      continue;
    }
    rmSync(skillPath, { recursive: true });
    console.log(`  ✓ removed ${name}`);
  }
  console.log('');
}
