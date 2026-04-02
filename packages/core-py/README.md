# antidrift

Python package for [antidrift](https://antidrift.io) — the open source company brain for AI coding tools. One repo your whole team shares — context, skills, and connected services.

Works with Claude Code, Codex, Cursor, and Antigravity.

## Install

```bash
pip install antidrift
```

## Quick start

```bash
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

```bash
pip install antidrift-skills
antidrift-skills list
antidrift-skills add <name>
```

## License

MIT — [antidrift.io](https://antidrift.io)
