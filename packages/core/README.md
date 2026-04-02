# @antidrift/core

Core library for [antidrift](https://antidrift.io) — the open source company brain for AI coding tools. Handles brain initialization, skill compilation, cross-platform sync, and MCP configuration.

> Most users should install `@antidrift/cli` instead. This package is the library that powers the CLI.

## Install

```bash
npm install @antidrift/core
```

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

## License

MIT — [antidrift.io](https://antidrift.io)
