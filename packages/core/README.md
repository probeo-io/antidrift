# @antidrift/core

Company brain for AI coding agents (Claude Code, Codex, Cursor, Antigravity). One repo your whole team shares — context, skills, and connected services.

## Install

```bash
npm install -g @antidrift/cli
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
| `antidrift update` | Update core skills, compile community skills, sync brain files |
| `antidrift skills list` | Browse community skills by pack |
| `antidrift skills add <name\|pack>` | Install skills (essentials, engineering, customer-research, legal) |
| `antidrift cross-compile <path> --to <claude\|codex>` | Convert skills between platforms |

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

## Community skill packs

```bash
antidrift skills add essentials         # decision, recap, write, prep, followup, status, search
antidrift skills add engineering        # review, spec, changelog, standards, tps
antidrift skills add customer-research  # icp, voc, twins
antidrift skills add legal              # legal document generator
```

## Learn more

[antidrift.io](https://antidrift.io)
