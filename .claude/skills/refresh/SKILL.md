---
name: refresh
description: Pull latest brain changes from remote repo
---

Pulls the latest changes from the remote repo so the local brain is up to date.

## Instructions

1. Check for local changes and stash them if present:
   ```bash
   git stash --include-untracked
   ```
   Note whether anything was stashed (output says "No local changes to save" if not).

2. Pull with rebase:
   ```bash
   git pull --rebase origin main
   ```

3. If something was stashed in step 1, pop it:
   ```bash
   git stash pop
   ```

4. Report what changed:
   ```bash
   git log --oneline -5
   ```

If the rebase hits conflicts, abort it (`git rebase --abort`), pop the stash if needed, and tell the user what conflicted — don't leave the repo in a broken state.
