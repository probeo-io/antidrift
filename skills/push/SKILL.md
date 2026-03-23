---
name: push
description: Commit and push all brain changes to remote repo
---

Commits all current changes and pushes to the remote repo.

## Instructions

1. Stage all changes:
```bash
git add -A
```

2. Check if there's anything to commit:
```bash
git status
```

If nothing to commit, report "Brain is clean, nothing to push." and stop.

3. Commit with a short descriptive message:
```bash
git commit -m "<describe what changed>"
```

4. Push:
```bash
git push origin main
```

If push fails (remote has new commits), pull first then push:
```bash
git pull --rebase origin main && git push origin main
```

5. Report what was pushed:
```bash
git log --oneline -3
```
