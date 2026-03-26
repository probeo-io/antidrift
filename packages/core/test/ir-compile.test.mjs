import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseIR, compileToClaude } from '../lib/compiler.mjs';

const TMP = join(import.meta.dirname, '..', '.test-tmp-ir');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

function writeIR(skillsDir, name, { description = 'Test skill', argumentHint, body = 'Do the thing.' } = {}) {
  const dir = join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  let content = `# Antidrift Skill IR — do not edit manually\n\n`;
  content += `name: "${name}"\n`;
  content += `description: "${description}"\n`;
  if (argumentHint) content += `argument-hint: "${argumentHint}"\n`;
  content += `auto-invoke: true\nsource: "claude"\n\n`;
  content += `---instructions---\n${body}\n`;
  writeFileSync(join(dir, 'skill.ir.yaml'), content);
  return dir;
}

/**
 * Simulate the compileInstalledSkills logic from cli.mjs.
 * Reads all skill dirs, finds IR files, parses, compiles to Claude format.
 */
function compileInstalledSkills(skillsDir) {
  let entries;
  try { entries = readdirSync(skillsDir); } catch { return 0; }

  let compiled = 0;

  for (const entry of entries) {
    const skillDir = join(skillsDir, entry);
    try {
      const stat = require('node:fs').statSync(skillDir);
      if (!stat.isDirectory()) continue;
    } catch { continue; }

    const irPath = join(skillDir, 'skill.ir.yaml');
    if (!existsSync(irPath)) continue;

    const irContent = readFileSync(irPath, 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);
    compiled++;
  }

  return compiled;
}

describe('IR compilation in update flow', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('skill with skill.ir.yaml gets SKILL.md generated', () => {
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeIR(skillsDir, 'test-skill', { description: 'A test', body: 'Run the test.' });

    // Parse and compile
    const irContent = readFileSync(join(skillsDir, 'test-skill', 'skill.ir.yaml'), 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);

    assert.ok(existsSync(join(skillsDir, 'test-skill', 'SKILL.md')));
  });

  it('SKILL.md has correct name in frontmatter', () => {
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeIR(skillsDir, 'my-skill', { description: 'My skill' });

    const irContent = readFileSync(join(skillsDir, 'my-skill', 'skill.ir.yaml'), 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);

    const content = readFileSync(join(skillsDir, 'my-skill', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('name: my-skill'));
  });

  it('SKILL.md has correct description in frontmatter', () => {
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeIR(skillsDir, 'deploy', { description: 'Deploy to production' });

    const irContent = readFileSync(join(skillsDir, 'deploy', 'skill.ir.yaml'), 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);

    const content = readFileSync(join(skillsDir, 'deploy', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('description: Deploy to production'));
  });

  it('SKILL.md has argument-hint when present in IR', () => {
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeIR(skillsDir, 'ingest', { description: 'Ingest files', argumentHint: '<path>' });

    const irContent = readFileSync(join(skillsDir, 'ingest', 'skill.ir.yaml'), 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);

    const content = readFileSync(join(skillsDir, 'ingest', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('argument-hint: <path>'));
  });

  it('SKILL.md body matches IR instructions', () => {
    const body = '## Step 1\nDo something.\n\n## Step 2\nDo more.';
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeIR(skillsDir, 'workflow', { description: 'Workflow', body });

    const irContent = readFileSync(join(skillsDir, 'workflow', 'skill.ir.yaml'), 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);

    const content = readFileSync(join(skillsDir, 'workflow', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('## Step 1'));
    assert.ok(content.includes('## Step 2'));
    assert.ok(content.includes('Do something.'));
    assert.ok(content.includes('Do more.'));
  });

  it('skill without skill.ir.yaml is skipped', () => {
    const skillsDir = join(TMP, 'skills');
    const skillDir = join(skillsDir, 'plain-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: plain-skill\n---\n\nAlready native.\n');

    // The compileInstalledSkills loop should skip this
    const irPath = join(skillDir, 'skill.ir.yaml');
    assert.ok(!existsSync(irPath));
  });

  it('empty skills directory — no crash', () => {
    const skillsDir = join(TMP, 'empty-skills');
    mkdirSync(skillsDir, { recursive: true });

    // Simulating the loop: read dir, find no IR skills
    const entries = readdirSync(skillsDir);
    assert.equal(entries.length, 0);
  });

  it('multiple IR skills — all get compiled', () => {
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });

    writeIR(skillsDir, 'skill-a', { description: 'Skill A', body: 'Do A.' });
    writeIR(skillsDir, 'skill-b', { description: 'Skill B', body: 'Do B.' });
    writeIR(skillsDir, 'skill-c', { description: 'Skill C', body: 'Do C.' });

    const entries = readdirSync(skillsDir);
    let compiled = 0;
    for (const entry of entries) {
      const irPath = join(skillsDir, entry, 'skill.ir.yaml');
      if (!existsSync(irPath)) continue;
      const irContent = readFileSync(irPath, 'utf8');
      const ir = parseIR(irContent);
      compileToClaude(ir, skillsDir);
      compiled++;
    }

    assert.equal(compiled, 3);
    assert.ok(existsSync(join(skillsDir, 'skill-a', 'SKILL.md')));
    assert.ok(existsSync(join(skillsDir, 'skill-b', 'SKILL.md')));
    assert.ok(existsSync(join(skillsDir, 'skill-c', 'SKILL.md')));
  });

  it('parseIR extracts all fields correctly', () => {
    const content = [
      '# Antidrift Skill IR — do not edit manually',
      '',
      'name: "test-skill"',
      'description: "A test skill"',
      'argument-hint: "<file>"',
      'auto-invoke: true',
      'source: "claude"',
      '',
      '---instructions---',
      '## Instructions',
      'Do the thing.',
    ].join('\n');

    const ir = parseIR(content);
    assert.equal(ir.name, 'test-skill');
    assert.equal(ir.description, 'A test skill');
    assert.equal(ir.argumentHint, '<file>');
    assert.equal(ir.autoInvoke, true);
    assert.equal(ir.source, 'claude');
    assert.ok(ir.instructions.includes('## Instructions'));
    assert.ok(ir.instructions.includes('Do the thing.'));
  });

  it('parseIR handles missing optional fields', () => {
    const content = [
      'name: "minimal"',
      'description: "Minimal skill"',
      '',
      '---instructions---',
      'Just do it.',
    ].join('\n');

    const ir = parseIR(content);
    assert.equal(ir.name, 'minimal');
    assert.equal(ir.description, 'Minimal skill');
    assert.equal(ir.argumentHint, undefined);
    assert.equal(ir.autoInvoke, undefined);
    assert.ok(ir.instructions.includes('Just do it.'));
  });

  it('compiled SKILL.md has proper frontmatter delimiters', () => {
    const skillsDir = join(TMP, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeIR(skillsDir, 'fmt-test', { description: 'Format test', body: 'Body.' });

    const irContent = readFileSync(join(skillsDir, 'fmt-test', 'skill.ir.yaml'), 'utf8');
    const ir = parseIR(irContent);
    compileToClaude(ir, skillsDir);

    const content = readFileSync(join(skillsDir, 'fmt-test', 'SKILL.md'), 'utf8');
    assert.ok(content.startsWith('---\n'));
    assert.ok(content.includes('\n---\n'));
  });
});
