# antidrift

Company brain for AI agents (Claude Code, Codex, Cursor, Antigravity). One repo your whole team shares — context, skills, and connected services.

## Quick start

```bash
pip install antidrift
antidrift init
```

## Join an existing brain

```bash
antidrift join <org/repo>
```

## Commands

| Command | What it does |
|---|---|
| `antidrift init` | Start a new brain |
| `antidrift join <repo>` | Clone and join an existing brain |
| `antidrift update` | Update core skills to latest |

## Core skills

Every brain ships with these slash commands:

| Skill | What it does |
|---|---|
| `/ingest <path>` | Import files and directories into the brain |
| `/push` | Save changes (commits locally, pushes if remote exists) |
| `/refresh` | Pull latest changes from remote |
| `/remote` | Set up GitHub so the team can share the brain |
| `/invite` | Get a command to send a coworker |
| `/publish <skill>` | Share a skill you built with the community |
| `/onboard` | Walk a new person through everything |

## Community skills

Browse and install extras from the community registry:

```bash
pip install antidrift-skills
antidrift-skills list
antidrift-skills add <name>
```

## Learn more

[antidrift.io](https://antidrift.io)
