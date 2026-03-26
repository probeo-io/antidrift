---
name: ingest
description: Ingest files and directories into the brain. Reads source files, categorizes them, and builds CLAUDE.md structure. Safe to run multiple times.
argument-hint: <path> [path2] [path3...]
---

Reads files from the specified directories, categorizes them, and builds them into the brain. Safe to run multiple times — updates existing content, never duplicates.

## Instructions

### Step 1 — Validate Paths

The user must provide at least one path via `$ARGUMENTS`.

If no paths provided, ask: "What directories should I ingest? Give me the paths."

For each path, verify it exists. If it doesn't, tell them and skip it.

### Step 2 — Detect Projects

For each path, check if it's a software project (has `package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, `Gemfile`, `.git/`, etc.).

If it's a project:
1. Extract metadata:
   - **Name**: from package.json name, go.mod module, pyproject.toml name, or directory name
   - **Repo URL**: from `git remote get-url origin` (if git repo)
   - **Stack**: from dependency files (e.g. "Node.js + TypeScript", "Go", "Python")
   - **Description**: from README.md first paragraph or package description
2. Add/update the project in `projects.md` using **repo URL as the unique key** (not path)
3. Save the **local path** to `.claude/local.json` (gitignored), keyed by project name:
   ```json
   { "projects": { "anymodel": "/Users/chris/Projects/anymodel" } }
   ```
   Never commit local paths — they're machine-specific.

If `.claude/local.json` doesn't exist, create it. If it exists, merge — don't overwrite other entries.

### Step 3 — Read and Categorize

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

### Step 4 — Show What Was Found

Before writing anything, show the user:
- How many files were read
- What categories were detected
- What projects were detected (with repo URLs)
- Proposed directory structure
- What will be **new** vs **updated** (check what already exists in the brain)

Ask: "Does this look right? Any changes before I build it?"

### Step 5 — Build the Brain (Idempotent)

**This step must be safe to run multiple times.** Check what already exists before writing.

For each department:
- If the department's `CLAUDE.md` **already exists**: merge new content into it. Don't overwrite existing sections — add new information alongside what's there. Remove stale entries if the source data has changed.
- If the department's `CLAUDE.md` **doesn't exist**: create it with summaries, links, and `_[Add]_` placeholders for gaps.

For the root `CLAUDE.md`:
- Update the navigation table — add new departments, keep existing ones
- Update priorities or context if new information was found
- Don't remove sections that weren't part of this ingest

For `projects.md`:
- Match existing projects by repo URL — update, don't duplicate
- Add new projects at the end

For every `CLAUDE.md` created or updated (including the root), also write an identical `AGENTS.md` in the same directory. This ensures the brain works across both Claude Code and Codex.

Move or copy source files into the appropriate directories. Heavy reference material goes in `_reference/` subdirectories.

### Step 6 — Report

Show what was created or updated:
- Departments created vs updated
- Projects detected
- Files organized
- Gaps that need filling

## Key Principles

- **Idempotent.** Running ingest twice with the same path produces the same result, not duplicates.
- **Don't over-organize.** Match how the content is structured, not a template.
- **Don't lose context.** Keep valuable notes — don't summarize away detail.
- **Keep CLAUDE.md files lean.** Summaries and pointers, not full documents.
- **Ask, don't assume.** If you're not sure where something goes, ask.
- **Separate shared from local.** Project metadata is shared; filesystem paths are local.
