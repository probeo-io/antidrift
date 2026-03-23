---
name: refresh
description: Pull latest brain changes from remote repo
---

Pulls the latest changes from the remote repo so the local brain is up to date.

## Instructions

Run:
```bash
git pull --ff-only origin main
```

If that fails (diverged history), show the user the status and ask how to proceed — don't force-pull or reset.

After pulling, report what changed:
```bash
git log --oneline -5
```
