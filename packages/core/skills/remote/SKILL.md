---
name: remote
description: Set up a GitHub remote so the brain can be shared with the team
---

## Instructions

1. Read `.claude/brain.json` for `repo`. If found, report it and stop.
2. Check `git remote get-url origin`. If found, save to `.claude/brain.json` and stop.
3. If `gh` is available, ask for org/username, then: `gh repo create <org>/$(basename $(pwd)) --private --source=. --push`
4. If `gh` is not available, tell them to create a repo on GitHub and run `git remote add origin <url> && git push -u origin main`.
5. After setup, write the repo slug to `.claude/brain.json`: `{ "repo": "<org>/<repo>" }`
