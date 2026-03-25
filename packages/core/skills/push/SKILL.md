---
name: push
description: Commit brain changes. Pushes to remote if one exists, commits locally if not.
---

Saves all current changes. Pushes to remote if configured, otherwise just commits locally.

## Instructions

### Step 1 — Sync CLAUDE.md ↔ AGENTS.md

Before committing, sync brain files across platforms. Walk all directories and for each `CLAUDE.md` found, copy its content to `AGENTS.md` in the same directory (create it if it doesn't exist). If only `AGENTS.md` exists (no `CLAUDE.md`), copy it to `CLAUDE.md`.

```bash
find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read f; do
  dir=$(dirname "$f")
  cp "$f" "$dir/AGENTS.md"
done

find . -name "AGENTS.md" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read f; do
  dir=$(dirname "$f")
  if [ ! -f "$dir/CLAUDE.md" ]; then
    cp "$f" "$dir/CLAUDE.md"
  fi
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

If push fails (remote has new commits), pull first:
```bash
git pull --rebase origin main && git push origin main
```

If no remote exists, just report "Committed locally." That's fine — they can set up a remote later when they're ready to share.

### Step 5 — Report
```bash
git log --oneline -3
```
