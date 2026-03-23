---
name: init
description: Initialize a company brain from scratch or migrate from an existing system (Obsidian, Notion, markdown files, etc.)
---

Builds a company brain by reading what exists and asking questions to fill gaps.

## Instructions

### Step 1 — Discover What Exists

Ask: "Where does your company knowledge live today?"

Options:
- Obsidian vault → ask for the vault path
- Notion export → ask for the export folder path
- Markdown files → ask for the folder path
- Google Docs → note that you'll need them exported or copy-pasted
- Multiple sources → handle each one
- "It's all in my head" → skip to Step 3

### Step 2 — Read and Categorize

Read through the source files. For each file, classify it:

| Category | Examples |
|---|---|
| product | Roadmaps, feature specs, PRDs, release notes |
| customers | Account notes, meeting notes per client, contracts |
| marketing | Positioning docs, brand voice, campaign notes, ICPs |
| sales | Pipeline notes, prospect lists, outreach templates, CRM exports |
| engineering | Architecture docs, coding standards, tech stack notes, ADRs |
| devops | Infrastructure notes, deploy docs, runbooks |
| ops | Setup guides, recurring workflows, checklists |
| finance | Revenue tracking, expense lists, tax notes |
| decisions | "Why we did X" docs, post-mortems, strategy memos |
| reference | Large docs, research, raw data — goes in `_reference/` |
| unknown | Ask the user what it is |

Don't force categories. If the user's knowledge doesn't fit these, create new departments that match how they think.

### Step 3 — Ask What's Missing

After reading existing files (or if starting from scratch), ask these questions one at a time:

1. "What's your company name and what do you do?" (one paragraph)
2. "What's your current stage?" (pre-revenue, early revenue, growth, etc.)
3. "Who are your customers?" (names, what they pay, what you do for them)
4. "What are you building?" (products, stack)
5. "What are your active priorities right now?" (top 3-5)
6. "What tools do you use?" (CRM, bookkeeping, cloud providers, dev tools)
7. "Anything else that's important that I should know?"

Skip any question where the source files already provided the answer.

### Step 4 — Build the Brain

Create the directory structure based on what you found:

```bash
mkdir -p product/decisions product/roadmap customers marketing sales engineering devops ops finance
```

For each department that has content, create a `CLAUDE.md` that:
- Summarizes what's known (from source files + answers)
- Links to detailed files where they exist
- Leaves `_[Add]_` placeholders for gaps

Move or copy source files into the appropriate directories. Heavy reference material goes in `_reference/` subdirectories.

Create the root `CLAUDE.md` with:
- Company name and description
- Navigation table (directory → what's in it)
- Active priorities
- Stack overview
- Conventions

Create `projects.md` with known tools and systems.

### Step 5 — Initialize Git

```bash
git init
git branch -m main
git add -A
git commit -m "Initial brain — built from [source]"
```

Ask if they want to push to GitHub:
```bash
gh repo create [org]/[name] --private --source=. --push
```

### Step 6 — Report

Show what was created:
- How many departments
- How many files migrated
- What gaps remain (listed as TODOs)
- Remind them about personal skills at `~/.claude/skills/`

Then run `/onboard` to walk them through what was built.

## Key Principles

- **Don't over-organize.** Match how the user thinks, not a template.
- **Don't lose context.** If a source file has valuable notes, keep them — don't summarize away the detail.
- **Keep CLAUDE.md files lean.** Summaries and pointers, not full documents. Put heavy content in the department directory or `_reference/`.
- **Ask, don't assume.** If you're not sure where something goes, ask.
