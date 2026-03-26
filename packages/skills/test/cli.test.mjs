import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TMP = join(import.meta.dirname, '..', '.test-tmp-skills');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

// ─── Extracted functions from skills/bin/cli.mjs ────────────────────────────
// These are copied from the source since they are not exported.

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

function getInstalledSkills(baseDir) {
  const skillsDir = join(baseDir, '.claude', 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter(d =>
    existsSync(join(skillsDir, d, 'SKILL.md')) || existsSync(join(skillsDir, d, 'skill.ir.yaml'))
  );
}

function resolveNames(names, registry) {
  const available = registry.map(s => s.name);
  const packs = {};
  for (const skill of registry) {
    if (skill.pack) {
      if (!packs[skill.pack]) packs[skill.pack] = [];
      packs[skill.pack].push(skill.name);
    }
  }

  const resolved = [];
  const notFound = [];
  for (const name of names) {
    if (name === '--all') {
      resolved.push(...available);
    } else if (packs[name]) {
      resolved.push(...packs[name]);
    } else if (available.includes(name)) {
      resolved.push(name);
    } else {
      notFound.push(name);
    }
  }
  return { resolved: [...new Set(resolved)], notFound };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('parseIRSimple', () => {
  it('extracts name from IR content', () => {
    const content = 'name: "deploy"\ndescription: "Deploy"\n\n---instructions---\nDo deploy.\n';
    const ir = parseIRSimple(content);
    assert.equal(ir.name, 'deploy');
  });

  it('extracts description from IR content', () => {
    const content = 'name: "test"\ndescription: "A test skill"\n\n---instructions---\nTest.\n';
    const ir = parseIRSimple(content);
    assert.equal(ir.description, 'A test skill');
  });

  it('extracts argumentHint from IR content', () => {
    const content = 'name: "ingest"\ndescription: "Ingest"\nargument-hint: "<path>"\n\n---instructions---\nIngest.\n';
    const ir = parseIRSimple(content);
    assert.equal(ir.argumentHint, '<path>');
  });

  it('extracts instructions body', () => {
    const content = 'name: "test"\ndescription: "Test"\n\n---instructions---\n## Step 1\nDo it.\n';
    const ir = parseIRSimple(content);
    assert.ok(ir.instructions.includes('## Step 1'));
    assert.ok(ir.instructions.includes('Do it.'));
  });

  it('handles missing instructions section', () => {
    const content = 'name: "test"\ndescription: "Test"\n';
    const ir = parseIRSimple(content);
    assert.equal(ir.instructions, '');
  });

  it('handles empty content', () => {
    const ir = parseIRSimple('');
    assert.equal(ir.name, '');
    assert.equal(ir.description, '');
    assert.equal(ir.instructions, '');
  });

  it('ignores comment lines', () => {
    const content = '# Comment\nname: "test"\n# Another comment\ndescription: "Test"\n\n---instructions---\nBody.\n';
    const ir = parseIRSimple(content);
    assert.equal(ir.name, 'test');
    assert.equal(ir.description, 'Test');
  });

  it('handles quoted and unquoted values', () => {
    const content = 'name: deploy\ndescription: Deploy to prod\n\n---instructions---\nDeploy.\n';
    const ir = parseIRSimple(content);
    assert.equal(ir.name, 'deploy');
    assert.equal(ir.description, 'Deploy to prod');
  });
});

describe('pack resolution', () => {
  const mockRegistry = [
    { name: 'review', description: 'Code review', pack: 'essentials' },
    { name: 'deploy', description: 'Deploy', pack: 'essentials' },
    { name: 'test', description: 'Run tests', pack: 'essentials' },
    { name: 'security', description: 'Security scan', pack: 'security' },
    { name: 'lint', description: 'Lint code', pack: 'quality' },
    { name: 'docs', description: 'Generate docs' },
  ];

  it('"essentials" resolves to list of skill names in that pack', () => {
    const { resolved } = resolveNames(['essentials'], mockRegistry);
    assert.deepEqual(resolved.sort(), ['deploy', 'review', 'test']);
  });

  it('"security" pack resolves correctly', () => {
    const { resolved } = resolveNames(['security'], mockRegistry);
    assert.deepEqual(resolved, ['security']);
  });

  it('unknown pack name treated as skill name if in registry', () => {
    const { resolved } = resolveNames(['docs'], mockRegistry);
    assert.deepEqual(resolved, ['docs']);
  });

  it('unknown name not in registry goes to notFound', () => {
    const { resolved, notFound } = resolveNames(['nonexistent'], mockRegistry);
    assert.equal(resolved.length, 0);
    assert.deepEqual(notFound, ['nonexistent']);
  });

  it('"--all" resolves to all skills', () => {
    const { resolved } = resolveNames(['--all'], mockRegistry);
    assert.equal(resolved.length, mockRegistry.length);
    for (const skill of mockRegistry) {
      assert.ok(resolved.includes(skill.name));
    }
  });

  it('mix of pack names and skill names', () => {
    const { resolved } = resolveNames(['essentials', 'docs'], mockRegistry);
    assert.ok(resolved.includes('review'));
    assert.ok(resolved.includes('deploy'));
    assert.ok(resolved.includes('test'));
    assert.ok(resolved.includes('docs'));
  });

  it('deduplicates when skill is in pack and also named explicitly', () => {
    const { resolved } = resolveNames(['essentials', 'review'], mockRegistry);
    const reviewCount = resolved.filter(n => n === 'review').length;
    assert.equal(reviewCount, 1);
  });

  it('empty names array returns empty', () => {
    const { resolved, notFound } = resolveNames([], mockRegistry);
    assert.equal(resolved.length, 0);
    assert.equal(notFound.length, 0);
  });
});

describe('getInstalledSkills', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('finds skills with SKILL.md', () => {
    const skillDir = join(TMP, '.claude', 'skills', 'review');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: review\n---\n\nReview.\n');

    const installed = getInstalledSkills(TMP);
    assert.deepEqual(installed, ['review']);
  });

  it('finds skills with skill.ir.yaml', () => {
    const skillDir = join(TMP, '.claude', 'skills', 'deploy');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'skill.ir.yaml'), 'name: "deploy"\n---instructions---\nDeploy.\n');

    const installed = getInstalledSkills(TMP);
    assert.deepEqual(installed, ['deploy']);
  });

  it('ignores directories without SKILL.md or skill.ir.yaml', () => {
    const skillDir = join(TMP, '.claude', 'skills', 'empty-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'README.md'), 'Nothing here');

    const installed = getInstalledSkills(TMP);
    assert.equal(installed.length, 0);
  });

  it('returns empty array when .claude/skills does not exist', () => {
    const installed = getInstalledSkills(TMP);
    assert.deepEqual(installed, []);
  });

  it('finds multiple installed skills', () => {
    const skillsBase = join(TMP, '.claude', 'skills');

    const s1 = join(skillsBase, 'review');
    mkdirSync(s1, { recursive: true });
    writeFileSync(join(s1, 'SKILL.md'), '---\nname: review\n---\n\nReview.\n');

    const s2 = join(skillsBase, 'deploy');
    mkdirSync(s2, { recursive: true });
    writeFileSync(join(s2, 'skill.ir.yaml'), 'name: "deploy"\n---instructions---\nDeploy.\n');

    const s3 = join(skillsBase, 'empty');
    mkdirSync(s3, { recursive: true });

    const installed = getInstalledSkills(TMP);
    assert.equal(installed.length, 2);
    assert.ok(installed.includes('review'));
    assert.ok(installed.includes('deploy'));
  });
});
