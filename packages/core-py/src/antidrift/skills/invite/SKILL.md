---
name: invite
description: Print the command a coworker can run to join the brain
---

## Instructions

1. Read `.claude/brain.json` for the `repo` field. If missing, run `git remote get-url origin`, extract the org/repo, and write it to `.claude/brain.json`.
2. If no repo found at all, say to run `/remote` first and stop.
3. Check if `antidrift` (pip) or `npx` (npm) is on PATH. Show the matching join command:

**pip:** `pip install antidrift && antidrift join <REPO>`
**npm:** `npx @antidrift/core join <REPO>`

Show whichever is installed. If both, show both.
