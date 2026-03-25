---
name: remote
description: Set up a GitHub remote so the brain can be shared with the team
---

Sets up a GitHub remote for the brain repo.

## Instructions

### Step 1 — Check if remote already exists
```bash
git remote get-url origin 2>/dev/null
```

If it exists, report the URL and stop.

### Step 2 — Check for gh CLI
```bash
gh --version 2>/dev/null
```

### Step 3a — If gh is available
Ask: "GitHub org or username?"

Then create the repo:
```bash
gh repo create <org>/$(basename $(pwd)) --private --source=. --push --description "Company brain"
```

Report the URL when done.

### Step 3b — If gh is not available
Tell them:
1. Create a repo on GitHub (private recommended)
2. Then run:
```bash
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```

Or install gh for a one-command setup:
- Mac: `brew install gh`
- Windows: `winget install GitHub.cli`
- Linux: `sudo apt install gh` or `sudo dnf install gh`
