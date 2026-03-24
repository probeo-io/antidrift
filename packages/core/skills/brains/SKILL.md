---
name: brains
description: List connected brains and query across them. Read files from related brains without switching.
argument-hint: [brain-name] [question]
---

Connected brains are listed in `.claude/brains.json` in the current brain's root.

## Instructions

### No arguments — list brains
Read `.claude/brains.json` and show all connected brains with their paths.

### With brain name — query it
Read the target brain's root CLAUDE.md to understand its structure, then answer the question using files from that brain.

Example: `/brains antidrift what packages exist?` → reads antidrift's package.json files and answers.

### Adding a brain
If the user says "add brain" or "connect brain", ask for:
- Name (short label)
- Path (absolute path on this machine)

Add it to `.claude/brains.json`. Create the file if it doesn't exist.

### Format of .claude/brains.json
```json
[
  { "name": "probeo", "path": "/Users/chriswelker/Projects/probeo.io/probeo-brain" },
  { "name": "antidrift", "path": "/Users/chriswelker/Projects/antidrift.io" }
]
```

### Reading from another brain
When querying another brain, read its CLAUDE.md first for navigation, then read specific files as needed. Treat it like a read-only reference — never write to another brain.
