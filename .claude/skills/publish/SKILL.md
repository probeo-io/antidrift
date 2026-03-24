---
name: publish
description: Publish a skill from your brain to the shared registry
argument-hint: <skill-name>
---

Publishes a skill from `.claude/skills/` to the `@antidrift/skills` registry via pull request.

## Instructions

### Step 1 — Pick the skill

If an argument was provided, use that. Otherwise, list the skills in `.claude/skills/` and ask which one to publish.

Verify the skill has a valid `SKILL.md` with `name` and `description` in the frontmatter. If not, help them fix it before continuing.

### Step 2 — Check for gh CLI
```bash
gh --version 2>/dev/null
```

If not installed, tell them to install it (`brew install gh`) and stop.

### Step 3 — Fork and clone the registry

```bash
gh repo fork probeo-io/antidrift --clone=false 2>/dev/null
```

Then clone their fork into a temp directory:
```bash
TMPDIR=$(mktemp -d)
gh repo clone probeo-io/antidrift "$TMPDIR/antidrift" -- --depth=1
```

### Step 4 — Copy the skill into the registry

```bash
cp -r .claude/skills/<skill-name> "$TMPDIR/antidrift/packages/skills/registry/<skill-name>"
```

### Step 5 — Create a branch, commit, and open a PR

```bash
cd "$TMPDIR/antidrift"
git checkout -b skill/<skill-name>
git add packages/skills/registry/<skill-name>
git commit -m "Add skill: <skill-name>"
gh pr create --repo probeo-io/antidrift --title "Add skill: <skill-name>" --body "Adds the **<skill-name>** skill to the shared registry.

## What it does
<paste the description from the SKILL.md frontmatter>

## Submitted via
\`/publish <skill-name>\`"
```

### Step 6 — Clean up and report

Remove the temp directory. Show the PR URL and tell them it's submitted for review.
