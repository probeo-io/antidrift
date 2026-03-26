---
name: push
description: Commit brain changes. Pushes to remote if one exists, commits locally if not.
---

Saves all current changes. Pushes to remote if configured, otherwise just commits locally.

## Instructions

### Step 1 — Sync brain files

Before committing, sync brain files across all platforms (Claude Code, Codex, Antigravity). Walk all directories and find any `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`. Use the first one found as the source of truth and copy to the others.

```bash
find . \( -name "CLAUDE.md" -o -name "AGENTS.md" -o -name "GEMINI.md" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.venv/*" | while read f; do
  dir=$(dirname "$f")
  name=$(basename "$f")
  # Use CLAUDE.md as source if it exists, otherwise AGENTS.md, otherwise GEMINI.md
  if [ -f "$dir/CLAUDE.md" ]; then
    src="$dir/CLAUDE.md"
  elif [ -f "$dir/AGENTS.md" ]; then
    src="$dir/AGENTS.md"
  else
    src="$dir/GEMINI.md"
  fi
  for target in CLAUDE.md AGENTS.md GEMINI.md; do
    if [ "$dir/$target" != "$src" ]; then
      cp "$src" "$dir/$target"
    fi
  done
done
```

### Step 2 — Check for changes
```bash
git add -A
git status
```

If nothing to commit, report "Brain is clean, nothing to save." and stop.

### Step 3 — Commit
```bash
git commit -m "<describe what changed>"
```

### Step 4 — Push if remote exists
```bash
git remote get-url origin 2>/dev/null
```

If a remote exists, push:
```bash
git push origin main
```

If push fails (remote has new commits), merge with an additive strategy:

```bash
git pull --no-rebase origin main
```

If there are merge conflicts on CLAUDE.md or AGENTS.md files, **always keep both sides**. Brain files are knowledge — both versions are valid. Accept both and move on:

```bash
# For each conflicted file:
# 1. Open the file
# 2. Remove the conflict markers (<<<<<<, ======, >>>>>>)
# 3. Keep ALL content from both sides
# 4. Save
git add -A
git commit -m "merge: keep both sides of brain update"
git push origin main
```

Never discard content from either side. Two duplicate lines is better than lost knowledge. Duplicates can be cleaned up later — lost context can't be recovered.

If no remote exists, just report "Committed locally." That's fine — they can set up a remote later when they're ready to share.

### Step 5 — Report
```bash
git log --oneline -3
```
