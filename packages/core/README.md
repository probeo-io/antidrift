# @antidrift/core

Company brain for Claude. One repo your whole team shares — context, skills, and connected services.

## Quick start

```bash
npx @antidrift/core init
```

## Join an existing brain

```bash
npx @antidrift/core join <org/repo>
```

## Commands

| Command | What it does |
|---|---|
| `npx @antidrift/core init` | Start a new brain |
| `npx @antidrift/core join <repo>` | Clone and join an existing brain |
| `npx @antidrift/core update` | Update core skills to latest |

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
npx @antidrift/skills list
npx @antidrift/skills add <name>
```

## Learn more

[antidrift.io](https://antidrift.io)
