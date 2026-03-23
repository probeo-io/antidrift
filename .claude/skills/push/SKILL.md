---
name: push
description: Commit and push all brain changes to remote repo. Sets up GitHub remote on first push if needed.
---

Commits all current changes and pushes to the remote repo.

## Instructions

### Step 1 — Check for changes
```bash
git add -A
git status
```

If nothing to commit, report "Brain is clean, nothing to push." and stop.

### Step 2 — Commit
```bash
git commit -m "<describe what changed>"
```

### Step 3 — Check for remote
```bash
git remote get-url origin
```

If no remote exists, help them set one up:
1. Ask: "No remote repo set up yet. What's your GitHub org or username?"
2. Use the brain directory name as the repo name
3. Check if `gh` CLI is available — if yes, create the repo:
   ```bash
   gh repo create <org>/<name> --private --source=. --push --description "Company brain"
   ```
4. If `gh` is not available, tell them to create a repo on GitHub and then run:
   ```bash
   git remote add origin https://github.com/<org>/<name>.git
   git push -u origin main
   ```

### Step 4 — Push
```bash
git push origin main
```

If push fails (remote has new commits), pull first:
```bash
git pull --rebase origin main && git push origin main
```

### Step 5 — Report
```bash
git log --oneline -3
```
