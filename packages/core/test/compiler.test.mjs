import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  decompileClaude,
  decompileCodex,
  compileToClaude,
  compileToCodex,
  crossCompile,
  decompileToIR,
  detectPlatform,
} from '../lib/compiler.mjs';

const TMP = join(import.meta.dirname, '..', '.test-tmp');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeClaudeSkill(name, { description = 'Test skill', argumentHint, body = 'Do the thing.' } = {}) {
  const dir = join(TMP, 'claude-skills', name);
  mkdirSync(dir, { recursive: true });
  let frontmatter = `---\nname: ${name}\ndescription: ${description}\n`;
  if (argumentHint) frontmatter += `argument-hint: ${argumentHint}\n`;
  frontmatter += '---\n\n';
  writeFileSync(join(dir, 'SKILL.md'), frontmatter + body);
  return dir;
}

function writeCodexSkill(name, { description = 'Test skill', body = 'Do the thing.', autoInvoke, tools } = {}) {
  const dir = join(TMP, 'codex-skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);

  if (autoInvoke !== undefined || tools) {
    const agentsDir = join(dir, 'agents');
    mkdirSync(agentsDir, { recursive: true });
    let yaml = '';
    if (autoInvoke !== undefined) {
      yaml += `policy:\n  allow_implicit_invocation: ${autoInvoke}\n`;
    }
    if (tools) {
      yaml += `\ndependencies:\n  tools:\n`;
      for (const t of tools) {
        yaml += `    - type: "${t.type}"\n      value: "${t.name}"\n`;
        if (t.description) yaml += `      description: "${t.description}"\n`;
      }
    }
    writeFileSync(join(agentsDir, 'openai.yaml'), yaml);
  }

  return dir;
}

function writeIRSkill(name, { description = 'Test skill', body = 'Do the thing.', argumentHint } = {}) {
  const dir = join(TMP, 'ir-skills', name);
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('detects Claude Code skill', () => {
    const dir = writeClaudeSkill('test-skill');
    assert.equal(detectPlatform(dir), 'claude');
  });

  it('detects Codex skill', () => {
    const dir = writeCodexSkill('test-skill', { autoInvoke: true });
    assert.equal(detectPlatform(dir), 'codex');
  });

  it('detects IR skill', () => {
    const dir = writeIRSkill('test-skill');
    assert.equal(detectPlatform(dir), 'ir');
  });

  it('throws for empty directory', () => {
    const dir = join(TMP, 'empty');
    mkdirSync(dir, { recursive: true });
    assert.throws(() => detectPlatform(dir), /Cannot detect platform/);
  });
});

describe('decompileClaude', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('extracts name and description from frontmatter', () => {
    const dir = writeClaudeSkill('review', { description: 'Reviews code' });
    const ir = decompileClaude(dir);
    assert.equal(ir.name, 'review');
    assert.equal(ir.description, 'Reviews code');
    assert.equal(ir.source, 'claude');
  });

  it('extracts argument-hint', () => {
    const dir = writeClaudeSkill('ingest', { argumentHint: '<path>' });
    const ir = decompileClaude(dir);
    assert.equal(ir.argumentHint, '<path>');
  });

  it('extracts instructions body', () => {
    const dir = writeClaudeSkill('test', { body: '## Step 1\nDo something.\n\n## Step 2\nDo more.' });
    const ir = decompileClaude(dir);
    assert.ok(ir.instructions.includes('## Step 1'));
    assert.ok(ir.instructions.includes('## Step 2'));
  });

  it('sets autoInvoke to true by default', () => {
    const dir = writeClaudeSkill('test');
    const ir = decompileClaude(dir);
    assert.equal(ir.autoInvoke, true);
  });

  it('throws if SKILL.md missing', () => {
    const dir = join(TMP, 'no-skill');
    mkdirSync(dir, { recursive: true });
    assert.throws(() => decompileClaude(dir), /No SKILL\.md found/);
  });
});

describe('decompileCodex', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('extracts name and description', () => {
    const dir = writeCodexSkill('deploy', { description: 'Deploy to prod' });
    const ir = decompileCodex(dir);
    assert.equal(ir.name, 'deploy');
    assert.equal(ir.description, 'Deploy to prod');
    assert.equal(ir.source, 'codex');
  });

  it('reads autoInvoke from openai.yaml', () => {
    const dir = writeCodexSkill('test', { autoInvoke: false });
    const ir = decompileCodex(dir);
    assert.equal(ir.autoInvoke, false);
  });

  it('reads tool dependencies from openai.yaml', () => {
    const dir = writeCodexSkill('test', {
      tools: [
        { type: 'mcp', name: 'search', description: 'Search the web' },
      ],
    });
    const ir = decompileCodex(dir);
    assert.ok(ir.tools);
    assert.equal(ir.tools.length, 1);
  });

  it('works without openai.yaml', () => {
    const dir = writeCodexSkill('simple', { description: 'No yaml' });
    const ir = decompileCodex(dir);
    assert.equal(ir.name, 'simple');
    assert.equal(ir.autoInvoke, undefined);
  });
});

describe('compileToClaude', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('creates SKILL.md with frontmatter', () => {
    const ir = { name: 'test', description: 'A test skill', instructions: '## Do it\nDo the thing.' };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToClaude(ir, outputDir);
    const content = readFileSync(join(result, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('name: test'));
    assert.ok(content.includes('description: A test skill'));
    assert.ok(content.includes('## Do it'));
  });

  it('includes argument-hint when present', () => {
    const ir = { name: 'test', description: 'Test', argumentHint: '<file>', instructions: 'Body.' };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToClaude(ir, outputDir);
    const content = readFileSync(join(result, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('argument-hint: <file>'));
  });

  it('does not create agents/ directory', () => {
    const ir = { name: 'test', description: 'Test', instructions: 'Body.' };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToClaude(ir, outputDir);
    assert.ok(!existsSync(join(result, 'agents')));
  });
});

describe('compileToCodex', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('creates SKILL.md', () => {
    const ir = { name: 'test', description: 'A test', instructions: 'Do it.' };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToCodex(ir, outputDir);
    assert.ok(existsSync(join(result, 'SKILL.md')));
  });

  it('creates agents/openai.yaml when autoInvoke is set', () => {
    const ir = { name: 'test', description: 'Test', instructions: 'Body.', autoInvoke: true };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToCodex(ir, outputDir);
    assert.ok(existsSync(join(result, 'agents', 'openai.yaml')));
    const yaml = readFileSync(join(result, 'agents', 'openai.yaml'), 'utf8');
    assert.ok(yaml.includes('allow_implicit_invocation: true'));
  });

  it('includes tool dependencies in openai.yaml', () => {
    const ir = {
      name: 'test', description: 'Test', instructions: 'Body.',
      tools: [{ type: 'mcp', name: 'search', description: 'Web search' }],
    };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToCodex(ir, outputDir);
    const yaml = readFileSync(join(result, 'agents', 'openai.yaml'), 'utf8');
    assert.ok(yaml.includes('dependencies:'));
    assert.ok(yaml.includes('value: "search"'));
  });

  it('skips agents/ when no config needed', () => {
    const ir = { name: 'test', description: 'Test', instructions: 'Body.' };
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const result = compileToCodex(ir, outputDir);
    assert.ok(!existsSync(join(result, 'agents')));
  });
});

describe('crossCompile', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('compiles claude → codex', () => {
    const dir = writeClaudeSkill('review', { description: 'Code review', body: 'Review the code.' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { ir, outputPath, warnings } = crossCompile(dir, 'claude', 'codex', outputDir);
    assert.equal(ir.name, 'review');
    assert.ok(existsSync(join(outputPath, 'SKILL.md')));
  });

  it('compiles codex → claude', () => {
    const dir = writeCodexSkill('deploy', { description: 'Deploy', body: 'Deploy it.', autoInvoke: true });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { ir, outputPath } = crossCompile(dir, 'codex', 'claude', outputDir);
    assert.equal(ir.name, 'deploy');
    const content = readFileSync(join(outputPath, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('Deploy it.'));
  });

  it('compiles IR → claude', () => {
    const dir = writeIRSkill('test', { description: 'Test', body: 'Do stuff.' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { ir, outputPath } = crossCompile(dir, 'ir', 'claude', outputDir);
    assert.equal(ir.name, 'test');
    assert.ok(existsSync(join(outputPath, 'SKILL.md')));
  });

  it('compiles IR → codex', () => {
    const dir = writeIRSkill('test', { description: 'Test', body: 'Do stuff.' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { ir, outputPath } = crossCompile(dir, 'ir', 'codex', outputDir);
    assert.equal(ir.name, 'test');
    assert.ok(existsSync(join(outputPath, 'SKILL.md')));
  });

  it('auto-detects source platform', () => {
    const dir = writeClaudeSkill('auto', { description: 'Auto detect' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { ir } = crossCompile(dir, 'auto', 'codex', outputDir);
    assert.equal(ir.name, 'auto');
    assert.equal(ir.source, 'claude');
  });

  it('warns about argument-hint when claude → codex', () => {
    const dir = writeClaudeSkill('test', { argumentHint: '<path>' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { warnings } = crossCompile(dir, 'claude', 'codex', outputDir);
    assert.ok(warnings.some(w => w.includes('argument-hint')));
  });

  it('warns about tool deps when codex → claude', () => {
    const dir = writeCodexSkill('test', {
      tools: [{ type: 'mcp', name: 'search' }],
    });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { warnings } = crossCompile(dir, 'codex', 'claude', outputDir);
    assert.ok(warnings.some(w => w.includes('tool dependencies')));
  });

  it('warns about bash blocks when claude → codex', () => {
    const dir = writeClaudeSkill('test', { body: '```bash\ngit status\n```\n\nDo stuff.' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { warnings } = crossCompile(dir, 'claude', 'codex', outputDir);
    assert.ok(warnings.some(w => w.includes('bash code blocks')));
  });
});

describe('decompileToIR', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('writes skill.ir.yaml', () => {
    const dir = writeClaudeSkill('test', { description: 'Test', body: 'Instructions here.' });
    const outputDir = join(TMP, 'output');
    mkdirSync(outputDir, { recursive: true });

    const { ir, outputPath } = decompileToIR(dir, 'claude', outputDir);
    assert.equal(ir.name, 'test');
    assert.ok(existsSync(join(outputPath, 'skill.ir.yaml')));

    const content = readFileSync(join(outputPath, 'skill.ir.yaml'), 'utf8');
    assert.ok(content.includes('---instructions---'));
    assert.ok(content.includes('Instructions here.'));
  });
});

describe('round-trip', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('claude → codex → claude preserves content', () => {
    const body = '## Step 1\nDo the first thing.\n\n## Step 2\nDo the second thing.';
    const dir = writeClaudeSkill('roundtrip', { description: 'Round trip test', body });

    const codexOut = join(TMP, 'codex-out');
    mkdirSync(codexOut, { recursive: true });
    crossCompile(dir, 'claude', 'codex', codexOut);

    const claudeOut = join(TMP, 'claude-out');
    mkdirSync(claudeOut, { recursive: true });
    const { ir } = crossCompile(join(codexOut, 'roundtrip'), 'codex', 'claude', claudeOut);

    assert.equal(ir.name, 'roundtrip');
    assert.ok(ir.instructions.includes('## Step 1'));
    assert.ok(ir.instructions.includes('## Step 2'));
  });

  it('claude → IR → codex preserves content', () => {
    const body = 'Check `$ARGUMENTS` for the path.';
    const dir = writeClaudeSkill('ir-round', { description: 'IR test', body });

    const irOut = join(TMP, 'ir-out');
    mkdirSync(irOut, { recursive: true });
    decompileToIR(dir, 'claude', irOut);

    const codexOut = join(TMP, 'codex-out');
    mkdirSync(codexOut, { recursive: true });
    const { ir } = crossCompile(join(irOut, 'ir-round'), 'ir', 'codex', codexOut);

    assert.equal(ir.name, 'ir-round');
    assert.ok(ir.instructions.includes('$ARGUMENTS'));
  });
});
