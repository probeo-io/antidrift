# antidrift

A company brain for Claude Code. Shared knowledge, shared skills, no more passing markdown files around.

## What It Is

Antidrift is a git repo that gives Claude Code full context on your company. Clone it on any machine and Claude knows your product, customers, stack, positioning, and how you work.

**Two things in the box:**
1. **The brain** — CLAUDE.md files organized by department. Claude reads them automatically.
2. **Skills** — slash commands that do real work. `/onboard`, `/push`, `/competitive-intel`, etc.

## Quick Start

```bash
git clone <your-brain-repo>
cd your-brain
claude
```

That's it. Claude loads the root CLAUDE.md and knows where everything is.

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

## Skill Packs

Skills are organized into packs by function.

### Core (ships with every brain)
| Command | What It Does |
|---|---|
| `/onboard` | Walk a new person through the brain interactively |
| `/refresh` | Pull latest brain changes from remote |
| `/push` | Commit and push all brain changes to remote |

### Operations Pack
| Command | What It Does |
|---|---|
| `/deploy` | Walk through deployment and dev environment setup |
| `/invoice` | Create and send invoices (requires MCP) |

### Growth Pack
| Command | What It Does |
|---|---|
| `/competitive-intel` | Run a competitive intelligence sweep |
| `/prospect` | Research and qualify prospects (requires MCP) |

### Content Pack
| Command | What It Does |
|---|---|
| `/blog-post` | Draft a blog post using brand voice |
| `/case-study` | Build a case study from customer data |

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

## Conventions

- Decisions go in `product/decisions/` as dated markdown files
- Customer work goes in `customers/[name]/`
- When something is deprecated, mark it clearly — don't delete context
- Keep CLAUDE.md files under 250 lines — use them as indexes, not documents
