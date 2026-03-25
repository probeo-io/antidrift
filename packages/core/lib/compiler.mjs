/**
 * Antidrift Skill Compiler
 *
 * Compiles skills between platforms via a universal intermediate representation (IR).
 *
 * Flow:
 *   native skill → decompile → IR (YAML) → compile → target native skill
 *
 * Supported platforms:
 *   - claude: Claude Code (.claude/skills/<name>/SKILL.md)
 *   - codex: OpenAI Codex (.agents/skills/<name>/SKILL.md + agents/openai.yaml)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { execSync } from 'node:child_process';

// ─── IR Schema ──────────────────────────────────────────────────────────────

/**
 * Universal skill intermediate representation.
 *
 * @typedef {object} SkillIR
 * @property {string} name
 * @property {string} description
 * @property {string} [version]
 * @property {string} [author]
 * @property {string} [argumentHint]
 * @property {boolean} [autoInvoke] - Whether the agent can invoke automatically
 * @property {string} instructions - Markdown body
 * @property {string[]} [tags]
 * @property {string} [source] - Original platform: 'claude' | 'codex'
 * @property {object} [ui] - Display metadata (from codex openai.yaml)
 * @property {string} [ui.displayName]
 * @property {string} [ui.shortDescription]
 * @property {string} [ui.brandColor]
 * @property {string} [ui.defaultPrompt]
 * @property {ToolDependency[]} [tools] - Required tools/MCP servers
 */

/**
 * @typedef {object} ToolDependency
 * @property {string} type - e.g. 'mcp'
 * @property {string} name
 * @property {string} [description]
 * @property {string} [url]
 */

// ─── Frontmatter Parser ────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content.trim() };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) meta[key] = value;
  }

  return { meta, body: match[2].trim() };
}

function serializeFrontmatter(meta, body) {
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

// ─── YAML Helpers (simple, no deps) ─────────────────────────────────────────

function serializeIR(ir) {
  const lines = ['# Antidrift Skill IR — do not edit manually', ''];
  const add = (key, val) => {
    if (val === undefined || val === null) return;
    if (typeof val === 'boolean') lines.push(`${key}: ${val}`);
    else if (typeof val === 'number') lines.push(`${key}: ${val}`);
    else lines.push(`${key}: "${val.replace(/"/g, '\\"')}"`);
  };

  add('name', ir.name);
  add('description', ir.description);
  add('version', ir.version);
  add('author', ir.author);
  add('argument-hint', ir.argumentHint);
  add('auto-invoke', ir.autoInvoke);
  add('source', ir.source);

  if (ir.tags?.length) {
    lines.push(`tags: [${ir.tags.map(t => `"${t}"`).join(', ')}]`);
  }

  if (ir.ui) {
    lines.push('ui:');
    if (ir.ui.displayName) lines.push(`  display-name: "${ir.ui.displayName}"`);
    if (ir.ui.shortDescription) lines.push(`  short-description: "${ir.ui.shortDescription}"`);
    if (ir.ui.brandColor) lines.push(`  brand-color: "${ir.ui.brandColor}"`);
    if (ir.ui.defaultPrompt) lines.push(`  default-prompt: "${ir.ui.defaultPrompt}"`);
  }

  if (ir.tools?.length) {
    lines.push('tools:');
    for (const tool of ir.tools) {
      lines.push(`  - type: "${tool.type}"`);
      lines.push(`    name: "${tool.name}"`);
      if (tool.description) lines.push(`    description: "${tool.description}"`);
      if (tool.url) lines.push(`    url: "${tool.url}"`);
    }
  }

  lines.push('');
  lines.push('---instructions---');
  lines.push(ir.instructions);

  return lines.join('\n');
}

function parseIR(content) {
  const ir = {
    name: '',
    description: '',
    instructions: '',
  };

  const instrSplit = content.split('---instructions---');
  const header = instrSplit[0];
  ir.instructions = (instrSplit[1] || '').trim();

  for (const line of header.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([\w-]+):\s*"?(.*?)"?\s*$/);
    if (!match) continue;

    const [, key, val] = match;
    switch (key) {
      case 'name': ir.name = val; break;
      case 'description': ir.description = val; break;
      case 'version': ir.version = val; break;
      case 'author': ir.author = val; break;
      case 'argument-hint': ir.argumentHint = val; break;
      case 'auto-invoke': ir.autoInvoke = val === 'true'; break;
      case 'source': ir.source = val; break;
    }
  }

  // Parse tags
  const tagsMatch = header.match(/tags:\s*\[(.*?)\]/);
  if (tagsMatch) {
    ir.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/"/g, ''));
  }

  return ir;
}

// ─── Decompilers (native → IR) ─────────────────────────────────────────────

/**
 * Decompile a Claude Code skill directory to IR.
 */
export function decompileClaude(skillDir) {
  const skillPath = join(skillDir, 'SKILL.md');
  if (!existsSync(skillPath)) {
    throw new Error(`No SKILL.md found in ${skillDir}`);
  }

  const content = readFileSync(skillPath, 'utf8');
  const { meta, body } = parseFrontmatter(content);

  return {
    name: meta.name || basename(skillDir),
    description: meta.description || '',
    argumentHint: meta['argument-hint'],
    autoInvoke: true, // Claude Code skills are auto-invokable by default
    instructions: body,
    source: 'claude',
  };
}

/**
 * Decompile a Codex skill directory to IR.
 */
export function decompileCodex(skillDir) {
  const skillPath = join(skillDir, 'SKILL.md');
  if (!existsSync(skillPath)) {
    throw new Error(`No SKILL.md found in ${skillDir}`);
  }

  const content = readFileSync(skillPath, 'utf8');
  const { meta, body } = parseFrontmatter(content);

  const ir = {
    name: meta.name || basename(skillDir),
    description: meta.description || '',
    instructions: body,
    source: 'codex',
  };

  // Parse agents/openai.yaml if it exists
  const yamlPath = join(skillDir, 'agents', 'openai.yaml');
  if (existsSync(yamlPath)) {
    const yamlContent = readFileSync(yamlPath, 'utf8');
    ir.ui = {};

    // Simple YAML parsing for known fields
    const getField = (key) => {
      const m = yamlContent.match(new RegExp(`${key}:\\s*"?(.*?)"?\\s*$`, 'm'));
      return m ? m[1] : undefined;
    };

    ir.ui.displayName = getField('display_name');
    ir.ui.shortDescription = getField('short_description');
    ir.ui.brandColor = getField('brand_color');
    ir.ui.defaultPrompt = getField('default_prompt');

    const implicitMatch = yamlContent.match(/allow_implicit_invocation:\s*(true|false)/);
    if (implicitMatch) {
      ir.autoInvoke = implicitMatch[1] === 'true';
    }

    // Parse tool dependencies
    const toolsSection = yamlContent.match(/dependencies:\s*\n\s*tools:\s*\n([\s\S]*?)(?:\n\w|\n*$)/);
    if (toolsSection) {
      ir.tools = [];
      const toolBlocks = toolsSection[1].split(/\n\s*- type:/);
      for (const block of toolBlocks) {
        if (!block.trim()) continue;
        const typeStr = block.includes('type:') ? block : `type: ${block}`;
        const type = getField.call(null, 'type') || 'mcp';
        const name = typeStr.match(/value:\s*"?(.*?)"?\s*$/m)?.[1] || '';
        const desc = typeStr.match(/description:\s*"?(.*?)"?\s*$/m)?.[1];
        const url = typeStr.match(/url:\s*"?(.*?)"?\s*$/m)?.[1];
        if (name) ir.tools.push({ type, name, description: desc, url });
      }
    }
  }

  return ir;
}

// ─── Compilers (IR → native) ────────────────────────────────────────────────

/**
 * Compile IR to Claude Code skill format.
 */
export function compileToClaude(ir, outputDir) {
  const skillDir = join(outputDir, ir.name);
  mkdirSync(skillDir, { recursive: true });

  const meta = {
    name: ir.name,
    description: ir.description,
  };
  if (ir.argumentHint) meta['argument-hint'] = ir.argumentHint;

  const content = serializeFrontmatter(meta, ir.instructions);
  writeFileSync(join(skillDir, 'SKILL.md'), content);

  return skillDir;
}

/**
 * Compile IR to Codex skill format.
 */
export function compileToCodex(ir, outputDir) {
  const skillDir = join(outputDir, ir.name);
  mkdirSync(skillDir, { recursive: true });

  // Write SKILL.md
  const meta = {
    name: ir.name,
    description: ir.description,
  };

  const content = serializeFrontmatter(meta, ir.instructions);
  writeFileSync(join(skillDir, 'SKILL.md'), content);

  // Write agents/openai.yaml if there's UI or tool config
  if (ir.ui || ir.tools?.length || ir.autoInvoke !== undefined) {
    const agentsDir = join(skillDir, 'agents');
    mkdirSync(agentsDir, { recursive: true });

    const yamlLines = [];

    if (ir.ui?.displayName || ir.ui?.shortDescription || ir.ui?.brandColor || ir.ui?.defaultPrompt) {
      yamlLines.push('interface:');
      if (ir.ui.displayName) yamlLines.push(`  display_name: "${ir.ui.displayName}"`);
      if (ir.ui.shortDescription) yamlLines.push(`  short_description: "${ir.ui.shortDescription}"`);
      if (ir.ui.brandColor) yamlLines.push(`  brand_color: "${ir.ui.brandColor}"`);
      if (ir.ui.defaultPrompt) yamlLines.push(`  default_prompt: "${ir.ui.defaultPrompt}"`);
    }

    if (ir.autoInvoke !== undefined) {
      yamlLines.push('');
      yamlLines.push('policy:');
      yamlLines.push(`  allow_implicit_invocation: ${ir.autoInvoke}`);
    }

    if (ir.tools?.length) {
      yamlLines.push('');
      yamlLines.push('dependencies:');
      yamlLines.push('  tools:');
      for (const tool of ir.tools) {
        yamlLines.push(`    - type: "${tool.type}"`);
        yamlLines.push(`      value: "${tool.name}"`);
        if (tool.description) yamlLines.push(`      description: "${tool.description}"`);
        if (tool.url) yamlLines.push(`      url: "${tool.url}"`);
      }
    }

    writeFileSync(join(agentsDir, 'openai.yaml'), yamlLines.join('\n') + '\n');
  }

  return skillDir;
}

// ─── Detect Platform ────────────────────────────────────────────────────────

/**
 * Detect the skill platform from a directory.
 * Returns 'claude', 'codex', or 'ir'.
 */
export function detectPlatform(skillDir) {
  if (existsSync(join(skillDir, 'agents', 'openai.yaml'))) return 'codex';
  if (existsSync(join(skillDir, 'SKILL.md'))) {
    // Check if it's IR format
    const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    if (content.includes('---instructions---')) return 'ir';
    return 'claude'; // Default — Claude Code and Codex both use SKILL.md, but without agents/ dir it's Claude
  }
  throw new Error(`Cannot detect platform for ${skillDir}`);
}

/**
 * Detect which agent tool is installed.
 */
export function detectAgent() {
  try {
    execSync('which claude', { stdio: 'ignore' });
    return 'claude';
  } catch {}
  try {
    execSync('which codex', { stdio: 'ignore' });
    return 'codex';
  } catch {}
  return null;
}

// ─── Cross-Compile (high-level) ─────────────────────────────────────────────

/**
 * Cross-compile a skill from one platform to another.
 *
 * @param {string} skillDir - Path to the source skill directory
 * @param {string} from - Source platform: 'claude' | 'codex' | 'auto'
 * @param {string} to - Target platform: 'claude' | 'codex'
 * @param {string} outputDir - Where to write the compiled skill
 * @returns {{ ir: SkillIR, outputPath: string, warnings: string[] }}
 */
export function crossCompile(skillDir, from, to, outputDir) {
  const warnings = [];

  // Detect source platform if auto
  if (from === 'auto') {
    from = detectPlatform(skillDir);
  }

  // Decompile to IR
  let ir;
  if (from === 'claude') {
    ir = decompileClaude(skillDir);
  } else if (from === 'codex') {
    ir = decompileCodex(skillDir);
  } else if (from === 'ir') {
    const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    ir = parseIR(content);
  } else {
    throw new Error(`Unknown source platform: ${from}`);
  }

  // Check for features that don't translate well
  if (from === 'codex' && to === 'claude') {
    if (ir.tools?.length) {
      warnings.push(`Skill has ${ir.tools.length} tool dependencies — Claude Code doesn't use agents/openai.yaml. Tools will need manual MCP setup.`);
    }
    if (ir.ui?.brandColor || ir.ui?.displayName) {
      warnings.push('UI metadata (brand color, display name) is Codex-specific and will be dropped.');
    }
  }

  if (from === 'claude' && to === 'codex') {
    if (ir.argumentHint) {
      warnings.push(`argument-hint "${ir.argumentHint}" is Claude Code-specific. Codex uses description for invocation matching.`);
    }
  }

  // Check for bash code blocks that might be executable
  const bashBlocks = (ir.instructions.match(/```bash\n[\s\S]*?```/g) || []);
  if (bashBlocks.length > 0 && from === 'claude' && to === 'codex') {
    warnings.push(`Skill contains ${bashBlocks.length} bash code blocks. In Claude Code these are interpreted; in Codex they may need to be moved to scripts/.`);
  }

  // Compile to target
  let outputPath;
  if (to === 'claude') {
    outputPath = compileToClaude(ir, outputDir);
  } else if (to === 'codex') {
    outputPath = compileToCodex(ir, outputDir);
  } else {
    throw new Error(`Unknown target platform: ${to}`);
  }

  return { ir, outputPath, warnings };
}

/**
 * Decompile a skill to IR format and save to disk.
 */
export function decompileToIR(skillDir, from, outputDir) {
  if (from === 'auto') from = detectPlatform(skillDir);

  let ir;
  if (from === 'claude') ir = decompileClaude(skillDir);
  else if (from === 'codex') ir = decompileCodex(skillDir);
  else throw new Error(`Unknown platform: ${from}`);

  const irDir = join(outputDir, ir.name);
  mkdirSync(irDir, { recursive: true });
  writeFileSync(join(irDir, 'skill.ir.yaml'), serializeIR(ir));

  return { ir, outputPath: irDir };
}
