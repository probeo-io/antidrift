---
name: ingest
description: Ingest files and directories into the brain. Reads source files, categorizes them, and builds CLAUDE.md structure.
argument-hint: <path> [path2] [path3...]
---

Reads files from the specified directories, categorizes them, and builds them into the brain.

## Instructions

### Step 1 — Validate Paths

The user must provide at least one path via `$ARGUMENTS`.

If no paths provided, ask: "What directories should I ingest? Give me the paths."

For each path, verify it exists. If it doesn't, tell them and skip it.

### Step 2 — Read and Categorize

Read through all files in the provided directories. For each file, classify it:

| Category | Examples |
|---|---|
| product | Roadmaps, feature specs, PRDs, release notes |
| customers | Account notes, meeting notes per client, contracts |
| marketing | Positioning docs, brand voice, campaign notes, ICPs |
| sales | Pipeline notes, prospect lists, outreach templates |
| engineering | Architecture docs, coding standards, tech stack notes |
| devops | Infrastructure notes, deploy docs, runbooks |
| ops | Setup guides, recurring workflows, checklists |
| finance | Revenue tracking, expense lists, tax notes |
| decisions | "Why we did X" docs, post-mortems, strategy memos |
| reference | Large docs, research, raw data — goes in `_reference/` |

Don't force categories. If the content doesn't fit, create departments that match how they think.

### Step 3 — Show What Was Found

Before writing anything, show the user:
- How many files were read
- What categories were detected
- Proposed directory structure

Ask: "Does this look right? Any changes before I build it?"

### Step 4 — Build the Brain

For each department that has content, create a `CLAUDE.md` that:
- Summarizes what's known from the ingested files
- Links to detailed files where they exist
- Leaves `_[Add]_` placeholders for gaps

Move or copy source files into the appropriate directories. Heavy reference material goes in `_reference/` subdirectories.

Create or update the root `CLAUDE.md` with:
- Navigation table (directory → what's in it)
- Any priorities or context found in the files

Create `projects.md` if project/tool information was found.

### Step 5 — Report

Show what was created:
- Departments created
- Files organized
- Gaps that need filling

## Key Principles

- **Don't over-organize.** Match how the content is structured, not a template.
- **Don't lose context.** Keep valuable notes — don't summarize away detail.
- **Keep CLAUDE.md files lean.** Summaries and pointers, not full documents.
- **Ask, don't assume.** If you're not sure where something goes, ask.
