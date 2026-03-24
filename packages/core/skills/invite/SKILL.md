---
name: invite
description: Print the command a coworker can run to clone the brain and start using it
---

Prints a ready-to-copy command that a coworker can paste into their terminal to get set up.

## Instructions

### Step 1 — Get the repo URL
```bash
git remote get-url origin 2>/dev/null
```

If no remote is configured, tell the user to run `/remote` first and stop.

### Step 2 — Print the invite

Output a message like:

---

Send this to your coworker:

```
git clone <REPO_URL> && cd <REPO_NAME> && cat CLAUDE.md
```

Once they've cloned it, they can run `claude` and say "I'm new here" to get walked through everything.

---

Keep it short. That's the whole skill.
