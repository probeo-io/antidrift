# antidrift

Company brain for AI coding agents. Shared knowledge, shared skills, works with Claude Code and Codex.

## What It Is

Antidrift is a git repo that gives your AI coding agent full context on your company. Clone it on any machine and it knows your product, customers, stack, positioning, and how you work.

**Two things in the box:**
1. **The brain** — CLAUDE.md / AGENTS.md files organized by department. Your agent reads them automatically.
2. **Skills** — slash commands that do real work. `/onboard`, `/push`, `/ingest`, `/write`, etc.

## Install

```bash
npm install -g @antidrift/cli
```

## Quick Start

```bash
antidrift init
```

That's it. Your agent loads the root brain file and knows where everything is.

## Packages

| Package | What It Does |
|---|---|
| `@antidrift/cli` | Unified CLI (`antidrift init`, `antidrift skills list`) |
| `@antidrift/core` | Brain + core skills + setup |
| `@antidrift/skills` | Community skill registry |
| `@antidrift/mcp-google` | Google Sheets, Docs, Drive, Gmail, Calendar |
| `@antidrift/mcp-stripe` | Stripe invoices, customers, products |
| `@antidrift/mcp-attio` | Attio CRM — people, companies, deals |

## Skill Packs

Install community skills by pack:

```bash
antidrift skills add essentials         # 7 skills — decision, recap, write, prep, followup, status, search
antidrift skills add engineering        # 5 skills — review, spec, changelog, standards, tps
antidrift skills add customer-research  # 3 skills — icp, voc, twins
antidrift skills add legal              # 1 skill — legal document generator
antidrift skills add --all              # everything
```

Browse available skills:

```bash
antidrift skills list
```

## How It Works

### The Brain

Every directory has a `CLAUDE.md`. Claude loads it automatically when working in that area.

```
your-brain/
├── CLAUDE.md              # Company overview, priorities, navigation
├── product/CLAUDE.md      # What you're building, roadmap
├── customers/CLAUDE.md    # Customer accounts
├── marketing/CLAUDE.md    # Positioning, campaigns
├── sales/CLAUDE.md        # Pipeline, outbound
├── engineering/CLAUDE.md  # Architecture, standards
├── finance/CLAUDE.md      # Revenue, expenses
├── ops/CLAUDE.md          # Setup, workflows
├── devops/CLAUDE.md       # Infrastructure, deploys
└── projects.md            # Project registry
```

Add a department by creating a directory with a CLAUDE.md. Nest as deep as you want. Claude discovers it all.

### Skills

Skills are slash commands that live in `.claude/skills/`. Type `/` in Claude Code to see them.

There are two layers:

#### Company Skills (shared)
Live in the brain repo at `.claude/skills/`. Everyone gets them via git.

```
.claude/skills/
├── onboard/SKILL.md       # /onboard — walk someone through the brain
├── refresh/SKILL.md       # /refresh — pull latest changes
├── push/SKILL.md          # /push — commit and push changes
└── ...
```

#### Personal Skills (yours only)
Live on your machine at `~/.claude/skills/`. Never shared unless you choose to.

```
~/.claude/skills/
├── my-shortcut/SKILL.md   # Your own prompts and workflows
├── draft-email/SKILL.md   # Whatever works for you
└── ...
```

Personal skills override company skills if they share a name.

#### Promoting a Personal Skill

When a personal skill is useful for the whole team:

1. Copy it from `~/.claude/skills/my-skill/` to `.claude/skills/my-skill/` in the brain repo
2. `/push` — everyone gets it on their next `/refresh`

#### Skill Format

A skill is a directory with a `SKILL.md` file:

```yaml
---
name: my-skill
description: What this skill does and when to use it
---

Instructions for Claude go here. Markdown.
```

That's it. No build step, no config, no framework.

## Keeping the Brain Efficient

Claude loads CLAUDE.md files automatically. Keep them concise — summaries and pointers, not full documents.

For large reference material (test results, research data, raw copy), put it in a `_reference/` subdirectory. Claude won't read it unless specifically asked.

```
marketing/
├── CLAUDE.md              # Summary — auto-loaded (~150 lines)
├── pricing-structure.md   # Active reference (~400 lines)
└── _reference/            # Heavy files — only on demand
    ├── twin-tests/        # (~3,000 lines)
    └── website-copy/      # (~6,000 lines)
```

## Cross-Platform (Claude Code + Codex)

Antidrift works across both Claude Code and OpenAI Codex. The brain creates both `CLAUDE.md` and `AGENTS.md` automatically — same content, both tools read it.

### Skill Compiler

Convert skills between platforms:

```bash
# Claude Code skill → Codex
antidrift cross-compile .claude/skills/my-skill --to codex

# Codex skill → Claude Code
antidrift cross-compile .agents/skills/my-skill --to claude
```

### How It Works

- **`init`** creates both `CLAUDE.md` and `AGENTS.md` at root
- **`/push`** syncs them before every commit
- **`/ingest`** creates both for every department
- **`update`** recompiles community skills for all detected platforms
- Community skills use a universal IR format — compiled to native on install

### Teams Using Both Tools

If your team has some people on Claude Code and some on Codex, everything just works. The brain files are identical, skills compile for both, and `/push` keeps everything in sync.

## Conventions

- Decisions go in `product/decisions/` as dated markdown files
- Customer work goes in `customers/[name]/`
- When something is deprecated, mark it clearly — don't delete context
- Keep CLAUDE.md files under 250 lines — use them as indexes, not documents

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on sharing skills and developing core.

## License

MIT
