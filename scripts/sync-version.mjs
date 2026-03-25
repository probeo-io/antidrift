#!/usr/bin/env node

/**
 * Syncs the version from version.json to all packages.
 *
 * Usage:
 *   node scripts/sync-version.mjs          # sync current version
 *   node scripts/sync-version.mjs 0.5.0    # set and sync new version
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const versionFile = join(root, 'version.json');
const versionData = JSON.parse(readFileSync(versionFile, 'utf8'));

// Allow overriding version via CLI arg
const newVersion = process.argv[2];
if (newVersion) {
  if (!/^\d+\.\d+\.\d+/.test(newVersion)) {
    console.error(`Invalid version: ${newVersion}`);
    process.exit(1);
  }
  versionData.version = newVersion;
  writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`Set version to ${newVersion}`);
}

const version = versionData.version;
console.log(`Syncing version: ${version}\n`);

// ─── package.json files ─────────────────────────────────────────────────────

const packageJsonFiles = [
  'packages/core/package.json',
  'packages/skills/package.json',
];

for (const file of packageJsonFiles) {
  const path = join(root, file);
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    const old = pkg.version;
    pkg.version = version;
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${file}: ${old} → ${version}`);
  } catch (err) {
    console.log(`  ${file}: SKIP (${err.message})`);
  }
}

// ─── pyproject.toml ─────────────────────────────────────────────────────────

const pyprojectFiles = [
  'packages/core-py/pyproject.toml',
];

for (const file of pyprojectFiles) {
  const path = join(root, file);
  try {
    let content = readFileSync(path, 'utf8');
    const oldMatch = content.match(/^version\s*=\s*"(.+?)"/m);
    const old = oldMatch ? oldMatch[1] : '?';
    content = content.replace(/^version\s*=\s*".+?"/m, `version = "${version}"`);
    writeFileSync(path, content);
    console.log(`  ${file}: ${old} → ${version}`);
  } catch (err) {
    console.log(`  ${file}: SKIP (${err.message})`);
  }
}

// ─── Python __version__ ─────────────────────────────────────────────────────

const pyVersionFiles = [
  'packages/core-py/src/antidrift/__init__.py',
];

for (const file of pyVersionFiles) {
  const path = join(root, file);
  try {
    let content = readFileSync(path, 'utf8');
    if (content.includes('__version__')) {
      const oldMatch = content.match(/__version__\s*=\s*"(.+?)"/);
      const old = oldMatch ? oldMatch[1] : '?';
      content = content.replace(/__version__\s*=\s*".+?"/, `__version__ = "${version}"`);
      writeFileSync(path, content);
      console.log(`  ${file}: ${old} → ${version}`);
    }
  } catch (err) {
    console.log(`  ${file}: SKIP (${err.message})`);
  }
}

console.log(`\nDone. All packages at ${version}.`);
