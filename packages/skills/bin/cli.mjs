#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const REPO = 'probeo-io/antidrift-skills';

function detectPlatforms() {
  const platforms = [];
  try { execSync('which claude', { stdio: 'ignore' }); platforms.push('claude'); } catch {}
  try { execSync('which codex', { stdio: 'ignore' }); platforms.push('codex'); } catch {}
  if (platforms.length === 0) platforms.push('claude'); // default
  return platforms;
}

function parseIRSimple(content) {
  const ir = { name: '', description: '', instructions: '' };
  const instrSplit = content.split('---instructions---');
  ir.instructions = (instrSplit[1] || '').trim();
  for (const line of (instrSplit[0] || '').split('\n')) {
    const m = line.trim().match(/^([\w-]+):\s*"?(.*?)"?\s*$/);
    if (!m) continue;
    if (m[1] === 'name') ir.name = m[2];
    else if (m[1] === 'description') ir.description = m[2];
    else if (m[1] === 'argument-hint') ir.argumentHint = m[2];
  }
  return ir;
}

const REGISTRY_URL = `https://api.github.com/repos/${REPO}/contents/registry.json`;
let _registryCache = null;

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
  if (_registryCache) return _registryCache;
  try {
    const result = execSync(`curl -sf -H "Accept: application/vnd.github.raw+json" "${REGISTRY_URL}"`, {
      stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8'
    });
    _registryCache = JSON.parse(result);
    return _registryCache;
  } catch {
    console.log('  Could not fetch registry.\n');
    process.exit(1);
  }
}

function getInstalledSkills() {
  const skillsDir = join(process.cwd(), '.claude', 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter(d =>
    existsSync(join(skillsDir, d, 'SKILL.md')) || existsSync(join(skillsDir, d, 'skill.ir.yaml'))
  );
}

function list() {
  const registry = fetchRegistry();
  const installed = new Set(getInstalledSkills());

  // Group by pack
  const packs = {};
  for (const skill of registry) {
    const pack = skill.pack || 'other';
    if (!packs[pack]) packs[pack] = [];
    packs[pack].push(skill);
  }

  console.log('');
  for (const [pack, skills] of Object.entries(packs)) {
    const packInstalled = skills.filter(s => installed.has(s.name)).length;
    console.log(`  ${pack} (${packInstalled}/${skills.length})`);
    for (const skill of skills) {
      const status = installed.has(skill.name) ? '✓' : '○';
      console.log(`    ${status} ${skill.name.padEnd(12)} ${skill.description}`);
    }
    console.log('');
  }

  const installedCount = registry.filter(s => installed.has(s.name)).length;
  console.log(`  ${installedCount}/${registry.length} installed`);
  console.log(`  Install a pack: npx @antidrift/skills add essentials\n`);
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
    console.log('         npx @antidrift/skills add essentials    Add the Essentials Starter Pack');
    console.log('         npx @antidrift/skills add --all         Add all community skills\n');
    return;
  }

  const registry = fetchRegistry();
  const available = registry.map(s => s.name);

  // Resolve pack names to individual skills
  const packs = {};
  for (const skill of registry) {
    if (skill.pack) {
      if (!packs[skill.pack]) packs[skill.pack] = [];
      packs[skill.pack].push(skill.name);
    }
  }

  const resolved = [];
  for (const name of names) {
    if (name === '--all') {
      resolved.push(...available);
    } else if (packs[name]) {
      console.log(`  Pack "${name}": ${packs[name].join(', ')}`);
      resolved.push(...packs[name]);
    } else if (available.includes(name)) {
      resolved.push(name);
    } else {
      console.log(`  ✗ "${name}" not found in registry`);
    }
  }

  const toInstall = [...new Set(resolved)];

  if (toInstall.length === 0) return;

  const registryDir = cloneRegistry();
  const skillsTarget = join(process.cwd(), '.claude', 'skills');
  mkdirSync(skillsTarget, { recursive: true });

  for (const skill of toInstall) {
    const src = join(registryDir, skill);
    if (existsSync(src)) {
      cpSync(src, join(skillsTarget, skill), { recursive: true });

      // If it's an IR skill, compile to native format for detected platform(s)
      const irPath = join(skillsTarget, skill, 'skill.ir.yaml');
      if (existsSync(irPath)) {
        try {
          const irContent = readFileSync(irPath, 'utf8');
          const ir = parseIRSimple(irContent);
          const platforms = detectPlatforms();

          // Compile SKILL.md (works for both Claude Code and Codex)
          const skillMd = `---\nname: ${ir.name}\ndescription: ${ir.description}\n${ir.argumentHint ? `argument-hint: ${ir.argumentHint}\n` : ''}---\n\n${ir.instructions}\n`;
          writeFileSync(join(skillsTarget, skill, 'SKILL.md'), skillMd);

          // If Codex is installed, also write to .agents/skills/
          if (platforms.includes('codex')) {
            const codexTarget = join(process.cwd(), '.agents', 'skills', skill);
            mkdirSync(codexTarget, { recursive: true });
            writeFileSync(join(codexTarget, 'SKILL.md'), skillMd);
          }

          console.log(`  ✓ ${skill} (compiled for ${platforms.join(' + ')})`);
        } catch (err) {
          console.log(`  ✓ ${skill} (IR compile failed: ${err.message})`);
        }
      } else {
        console.log(`  ✓ ${skill}`);
      }
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
