import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { syncBrainFiles } from '../lib/sync.mjs';

const TMP = join(import.meta.dirname, '..', '.test-tmp-sync');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

describe('syncBrainFiles', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('CLAUDE.md only — creates AGENTS.md and GEMINI.md', () => {
    writeFileSync(join(TMP, 'CLAUDE.md'), '# Brain');
    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 2);
    assert.equal(readFileSync(join(TMP, 'AGENTS.md'), 'utf8'), '# Brain');
    assert.equal(readFileSync(join(TMP, 'GEMINI.md'), 'utf8'), '# Brain');
  });

  it('AGENTS.md only — creates CLAUDE.md and GEMINI.md', () => {
    writeFileSync(join(TMP, 'AGENTS.md'), '# Agents brain');
    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 2);
    assert.equal(readFileSync(join(TMP, 'CLAUDE.md'), 'utf8'), '# Agents brain');
    assert.equal(readFileSync(join(TMP, 'GEMINI.md'), 'utf8'), '# Agents brain');
  });

  it('GEMINI.md only — creates CLAUDE.md and AGENTS.md', () => {
    writeFileSync(join(TMP, 'GEMINI.md'), '# Gemini brain');
    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 2);
    assert.equal(readFileSync(join(TMP, 'CLAUDE.md'), 'utf8'), '# Gemini brain');
    assert.equal(readFileSync(join(TMP, 'AGENTS.md'), 'utf8'), '# Gemini brain');
  });

  it('all three exist, CLAUDE.md differs — overwrites AGENTS.md and GEMINI.md', () => {
    writeFileSync(join(TMP, 'CLAUDE.md'), '# Updated');
    writeFileSync(join(TMP, 'AGENTS.md'), '# Old');
    writeFileSync(join(TMP, 'GEMINI.md'), '# Old');
    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 2);
    assert.equal(readFileSync(join(TMP, 'AGENTS.md'), 'utf8'), '# Updated');
    assert.equal(readFileSync(join(TMP, 'GEMINI.md'), 'utf8'), '# Updated');
  });

  it('all three exist and match — synced count is 0', () => {
    const content = '# Same content';
    writeFileSync(join(TMP, 'CLAUDE.md'), content);
    writeFileSync(join(TMP, 'AGENTS.md'), content);
    writeFileSync(join(TMP, 'GEMINI.md'), content);
    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 0);
  });

  it('sync works in nested subdirectories', () => {
    const sub = join(TMP, 'dept', 'sales');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, 'CLAUDE.md'), '# Sales');

    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 2);
    assert.equal(readFileSync(join(sub, 'AGENTS.md'), 'utf8'), '# Sales');
    assert.equal(readFileSync(join(sub, 'GEMINI.md'), 'utf8'), '# Sales');
  });

  it('syncs both root and nested directories', () => {
    writeFileSync(join(TMP, 'CLAUDE.md'), '# Root');
    const sub = join(TMP, 'sub');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, 'CLAUDE.md'), '# Sub');

    const { synced } = syncBrainFiles(TMP);
    // 2 files at root + 2 files in sub = 4
    assert.equal(synced, 4);
    assert.equal(readFileSync(join(TMP, 'AGENTS.md'), 'utf8'), '# Root');
    assert.equal(readFileSync(join(sub, 'AGENTS.md'), 'utf8'), '# Sub');
  });

  it('skips node_modules directory', () => {
    const nm = join(TMP, 'node_modules', 'pkg');
    mkdirSync(nm, { recursive: true });
    writeFileSync(join(nm, 'CLAUDE.md'), '# Should be skipped');

    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 0);
    assert.ok(!existsSync(join(nm, 'AGENTS.md')));
  });

  it('skips .git directory', () => {
    const gitDir = join(TMP, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, 'CLAUDE.md'), '# Should be skipped');

    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 0);
    assert.ok(!existsSync(join(gitDir, 'AGENTS.md')));
  });

  it('skips .venv directory', () => {
    const venv = join(TMP, '.venv', 'lib');
    mkdirSync(venv, { recursive: true });
    writeFileSync(join(venv, 'CLAUDE.md'), '# Should be skipped');

    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 0);
    assert.ok(!existsSync(join(venv, 'AGENTS.md')));
  });

  it('empty directory — no crash, synced is 0', () => {
    const { synced } = syncBrainFiles(TMP);
    assert.equal(synced, 0);
  });

  it('CLAUDE.md takes priority over AGENTS.md when both exist', () => {
    writeFileSync(join(TMP, 'CLAUDE.md'), '# Claude wins');
    writeFileSync(join(TMP, 'AGENTS.md'), '# Agents loses');
    const { synced } = syncBrainFiles(TMP);
    assert.ok(synced >= 1);
    assert.equal(readFileSync(join(TMP, 'AGENTS.md'), 'utf8'), '# Claude wins');
    assert.equal(readFileSync(join(TMP, 'GEMINI.md'), 'utf8'), '# Claude wins');
  });

  it('AGENTS.md takes priority over GEMINI.md when no CLAUDE.md', () => {
    writeFileSync(join(TMP, 'AGENTS.md'), '# Agents wins');
    writeFileSync(join(TMP, 'GEMINI.md'), '# Gemini loses');
    const { synced } = syncBrainFiles(TMP);
    assert.ok(synced >= 1);
    assert.equal(readFileSync(join(TMP, 'CLAUDE.md'), 'utf8'), '# Agents wins');
    assert.equal(readFileSync(join(TMP, 'GEMINI.md'), 'utf8'), '# Agents wins');
  });

  it('handles multiline content correctly', () => {
    const content = '# Brain\n\n## Section 1\nSome content.\n\n## Section 2\nMore content.\n';
    writeFileSync(join(TMP, 'CLAUDE.md'), content);
    syncBrainFiles(TMP);
    assert.equal(readFileSync(join(TMP, 'AGENTS.md'), 'utf8'), content);
    assert.equal(readFileSync(join(TMP, 'GEMINI.md'), 'utf8'), content);
  });
});
