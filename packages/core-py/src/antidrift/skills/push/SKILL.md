---
name: push
description: Commit brain changes. Pushes to remote if one exists, commits locally if not.
---

Saves all current changes. Pushes to remote if configured, otherwise just commits locally.

## Instructions

### Step 1 — Check for changes
```bash
git add -A
git status
```

If nothing to commit, report "Brain is clean, nothing to save." and stop.

### Step 2 — Commit
```bash
git commit -m "<describe what changed>"
```

### Step 3 — Push if remote exists
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

### Step 4 — Report
```bash
git log --oneline -3
```
