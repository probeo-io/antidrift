# antidrift

Company brain for you and your AI agents. Shared knowledge, shared skills, no more passing files around.

Works with Claude Code, Claude Cowork / Desktop, OpenAI Codex, Cursor, and Google Antigravity.

## The Problem

Every time you start a new session, your AI agent has no idea who you are, what your company does, who your customers are, or how you work. You repeat yourself constantly. Context drifts. Knowledge gets lost.

## The Fix

Antidrift is a git repo that gives your AI agents full context on your company. Product, customers, stack, positioning, decisions, standards — all of it. Clone it on any machine and your agent knows everything.

**Two things in the box:**
1. **The brain** — markdown files organized by department. Your agent reads them automatically.
2. **Skills** — slash commands that do real work: `/write`, `/review`, `/icp`, `/prep`, `/tps`, and more.

## Install

```bash
npm install -g @antidrift/cli
```

Or via Python:

```bash
pip install antidrift
```

## Quick Start

```bash
antidrift init
```

That's it. Your agent loads the brain and knows where everything is. Type `/ingest <path>` to start building context from your existing files.

## What's In the Brain

```
your-brain/
├── CLAUDE.md              # Company overview, priorities, navigation
├── AGENTS.md              # Same content — for Codex users
├── product/               # What you're building, roadmap
├── customers/             # Account data, meeting notes, agreements
├── marketing/             # Positioning, brand voice, campaigns, ICPs
├── sales/                 # Pipeline, prospects, outreach
├── engineering/           # Architecture, coding standards, specs
├── finance/               # Revenue, expenses
├── decisions/             # Why we made the choices we made
└── projects.md            # Project registry with repo URLs
```

Add a department by creating a directory. Nest as deep as you want. Your agent discovers it all.

## Skills

Skills are slash commands. Type `/` to see them.

### Core (ships with every brain)

| Skill | What it does |
|---|---|
| `/ingest <path>` | Import files and directories into the brain |
| `/push` | Commit and push changes (syncs brain files, merges additively) |
| `/refresh` | Pull latest changes from remote |
| `/onboard` | Walk a new person through everything |
| `/publish <skill>` | Share a skill with the community |

### Community Skill Packs

```bash
antidrift skills add essentials         # decision, recap, write, prep, followup, status, search
antidrift skills add engineering        # review, spec, changelog, standards, tps
antidrift skills add customer-research  # icp, voc, twins
antidrift skills add legal              # legal document generator
antidrift skills add --all              # everything
```

| Pack | Skills |
|------|--------|
| **essentials** | `/decision` — log decisions with context and reasoning |
| | `/recap` — what changed since last time |
| | `/write` — write anything using brand voice + brain context |
| | `/prep` — prep for a customer call from account data |
| | `/followup` — draft follow-up emails after meetings |
| | `/status` — brain health, freshness, gaps |
| | `/search` — search across the entire brain |
| **engineering** | `/review` — code review using team standards from the brain |
| | `/spec` — technical spec using architecture context |
| | `/changelog` — generate changelog from git history |
| | `/standards` — generate coding standards from existing code |
| | `/tps` — TPS report from git history (yes, that TPS report) |
| **customer-research** | `/icp` — build research-backed Ideal Customer Profiles |
| | `/voc` — Voice of Customer analysis in their actual language |
| | `/twins` — create AI twin personas for market testing |
| **legal** | `/legal` — generate NDAs, subscription agreements, PSAs from templates |

Browse what's available:

```bash
antidrift skills list
```

## How It Works

### Your Agent Reads the Brain Automatically

Every directory has a brain file (`CLAUDE.md` for Claude Code, `AGENTS.md` for Codex). Your agent loads it when working in that area. Only what's relevant gets loaded — not the whole brain at once.

### Skills Are Just Markdown

A skill is a directory with a `SKILL.md` file:

```yaml
---
name: my-skill
description: What this skill does and when to use it
---

Instructions for your agent go here. Markdown.
```

No build step. No framework. No config.

### Two Layers of Skills

**Company skills** live in the brain repo at `.claude/skills/`. Everyone gets them via git.

**Personal skills** live on your machine at `~/.claude/skills/`. Never shared unless you choose to. Personal skills override company skills if they share a name.

When a personal skill is useful for the team: copy it to the brain repo and `/push`.

### Keeping the Brain Efficient

Brain files are indexes, not documents. Keep them under 250 lines — summaries and pointers.

Heavy reference material goes in `_reference/` subdirectories. Your agent won't read it unless asked.

```
marketing/
├── CLAUDE.md              # Summary — auto-loaded (~150 lines)
├── pricing-structure.md   # Active reference
└── _reference/            # Heavy files — only on demand
    ├── twin-tests/
    └── voc/
```

## Supported Platforms

Antidrift works across all major AI coding platforms on the same brain.

| Platform | Brain File | Config File |
|---|---|---|
| Claude Code | CLAUDE.md | .mcp.json |
| Claude Cowork / Desktop | CLAUDE.md | claude_desktop_config.json |
| OpenAI Codex | AGENTS.md | — |
| Cursor | AGENTS.md | — |
| Google Antigravity | GEMINI.md | — |

- `antidrift init` creates CLAUDE.md, AGENTS.md, and GEMINI.md
- `/push` syncs them before every commit
- `/ingest` creates all brain files for every department
- Community skills compile to the right format on install
- Teams can mix platforms — everything stays in sync

### Skill Compiler

Convert skills between platforms:

```bash
antidrift cross-compile .claude/skills/my-skill --to codex
antidrift cross-compile .agents/skills/my-skill --to claude
```

## Connect Services

Connect external services as MCP servers — your AI agent gets live access to your tools.

```bash
antidrift connect google                # Google Workspace
antidrift connect stripe                # Stripe
antidrift connect attio                 # Attio CRM
antidrift connect github                # GitHub
```

### Platform targeting

By default, `connect` installs for Claude Code. Use flags to target other platforms:

```bash
antidrift connect stripe --cowork       # Claude Cowork / Desktop
antidrift connect stripe --all          # All detected platforms
antidrift connect stripe --claude-code  # Claude Code (explicit)
```

## Packages

| Package | What It Does |
|---|---|
| `@antidrift/cli` | Unified CLI |
| `@antidrift/core` | Brain + core skills + setup |
| `@antidrift/skills` | Community skill registry |
| `@antidrift/mcp-google` | Google Workspace (Sheets, Docs, Drive, Gmail, Calendar) |
| `@antidrift/mcp-stripe` | Stripe (invoices, customers, subscriptions, charges, payment links) |
| `@antidrift/mcp-attio` | Attio CRM (people, companies, deals, tasks, notes) |
| `@antidrift/mcp-github` | GitHub (repos, issues, PRs, actions, releases, traffic) |

## Learn More

[antidrift.io](https://antidrift.io)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on sharing skills and developing core.

## License

MIT
