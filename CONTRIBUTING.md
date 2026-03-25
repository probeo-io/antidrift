# Contributing to antidrift

## Skills

The easiest way to contribute is by sharing a skill.

### Publishing a skill from your brain

Inside Claude Code:
```
/publish my-skill
```

This opens a PR against the [community skills registry](https://github.com/probeo-io/antidrift-skills).

### Writing a new skill

1. Create a directory in `.claude/skills/` or `~/.claude/skills/`
2. Add a `SKILL.md` with frontmatter:

```yaml
---
name: my-skill
description: What it does and when to trigger
---

Instructions for Claude here.
```

3. Test it — type `/my-skill` in Claude Code
4. Publish it — `/publish my-skill`

### Cross-platform skills

Skills in the community registry use the antidrift IR (intermediate representation) format. When you publish via `/publish`, your skill is automatically decompiled to IR.

Users installing your skill get it compiled to their platform (Claude Code or Codex) automatically.

If you want to test cross-compilation manually:
```bash
npx @antidrift/core cross-compile .claude/skills/my-skill --to codex --output /tmp/test
```

## Core development

### Setup

```bash
git clone https://github.com/probeo-io/antidrift.git
cd antidrift
```

### Structure

```
packages/
  core/           @antidrift/core — brain + skills + CLI
  core-py/        antidrift (Python) — Python installer
  skills/         @antidrift/skills — community skills CLI
  mcp-google/     @antidrift/mcp-google
  mcp-stripe/     @antidrift/mcp-stripe
  mcp-attio/      @antidrift/mcp-attio
  legal/          @antidrift/legal
```

### Testing

```bash
cd packages/core
npm test
```

Uses Node's built-in test runner — no dependencies.

### Guidelines

- Keep it simple. No build step, no framework, no unnecessary dependencies.
- Core has zero dependencies by design. Keep it that way.
- Skills are markdown instructions, not code. Claude interprets them.
- Test cross-platform changes against both Claude Code and Codex skill formats.
