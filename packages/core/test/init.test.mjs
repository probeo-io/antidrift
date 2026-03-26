import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TMP = join(import.meta.dirname, '..', '.test-tmp-init');
const coreSkillsSource = join(import.meta.dirname, '..', 'skills');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

/**
 * Simulate init output structure without the interactive prompts.
 * Mirrors the file-creation steps from cli.mjs init().
 */
function simulateInit(targetDir, companyName) {
  mkdirSync(targetDir, { recursive: true });

  // .gitignore
  writeFileSync(
    join(targetDir, '.gitignore'),
    'scratch/\n.code/\n.env\n.env.*\n*.local\n.DS_Store\n.claude/local.json\n'
  );

  // Core skills
  const skillsTarget = join(targetDir, '.claude', 'skills');
  mkdirSync(skillsTarget, { recursive: true });
  const skills = readdirSync(coreSkillsSource);
  for (const skill of skills) {
    cpSync(join(coreSkillsSource, skill), join(skillsTarget, skill), { recursive: true });
  }

  // Brain files
  const claudeMd = `# ${companyName} — Company Brain\n\n## Getting Started\nContent here.\n`;
  writeFileSync(join(targetDir, 'CLAUDE.md'), claudeMd);
  writeFileSync(join(targetDir, 'AGENTS.md'), claudeMd);
  writeFileSync(join(targetDir, 'GEMINI.md'), claudeMd);
}

describe('init file outputs', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('creates CLAUDE.md, AGENTS.md, GEMINI.md with same content', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Acme Corp');

    assert.ok(existsSync(join(dir, 'CLAUDE.md')));
    assert.ok(existsSync(join(dir, 'AGENTS.md')));
    assert.ok(existsSync(join(dir, 'GEMINI.md')));

    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    const gemini = readFileSync(join(dir, 'GEMINI.md'), 'utf8');

    assert.equal(claude, agents);
    assert.equal(claude, gemini);
  });

  it('brain files contain company name', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Acme Corp');

    const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes('Acme Corp'));
  });

  it('.gitignore includes .claude/local.json', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.claude/local.json'));
  });

  it('.gitignore includes .env', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.env'));
  });

  it('.claude/skills/ directory is created', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    assert.ok(existsSync(join(dir, '.claude', 'skills')));
  });

  it('core skills are installed', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    const expectedSkills = readdirSync(coreSkillsSource);
    for (const skill of expectedSkills) {
      assert.ok(
        existsSync(join(dir, '.claude', 'skills', skill)),
        `Expected skill directory: ${skill}`
      );
    }
  });

  it('core skills have SKILL.md files', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    const expectedSkills = readdirSync(coreSkillsSource);
    for (const skill of expectedSkills) {
      assert.ok(
        existsSync(join(dir, '.claude', 'skills', skill, 'SKILL.md')),
        `Expected SKILL.md in ${skill}`
      );
    }
  });

  it('installed skill count matches source', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    const sourceSkills = readdirSync(coreSkillsSource);
    const installedSkills = readdirSync(join(dir, '.claude', 'skills'));
    assert.equal(installedSkills.length, sourceSkills.length);
  });

  it('SKILL.md files have frontmatter with name', () => {
    const dir = join(TMP, 'test-brain');
    simulateInit(dir, 'Test Co');

    const skills = readdirSync(coreSkillsSource);
    for (const skill of skills) {
      const content = readFileSync(join(dir, '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
      assert.ok(content.startsWith('---'), `${skill}/SKILL.md should start with frontmatter`);
      assert.ok(content.includes('name:'), `${skill}/SKILL.md should have name in frontmatter`);
    }
  });
});
