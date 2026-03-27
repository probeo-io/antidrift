# antidrift

Company brain for you and your AI agents. Shared knowledge, shared skills, no more passing files around.

Works with Claude Code, Claude Cowork / Desktop, OpenAI Codex, Cursor, and Google Antigravity.

## Install

```bash
npm install -g @antidrift/cli
```

Or via Python:

```bash
pip install antidrift
```

## Quick Start

```bash
antidrift init
```

## Commands

```bash
antidrift init                          Start a new brain
antidrift join <repo>                   Join an existing brain
antidrift update                        Update core skills + sync brain files

antidrift skills list                   Browse community skills (by pack)
antidrift skills add <name|pack>        Add skills
antidrift skills add --all              Add all community skills
antidrift skills remove <name>          Remove a skill

antidrift cross-compile <path> --to <claude|codex>

antidrift connect google                Google Workspace (Sheets, Docs, Drive, Gmail, Calendar)
antidrift connect stripe                Stripe (invoices, customers, subscriptions)
antidrift connect attio                 Attio CRM (people, companies, deals, tasks)
antidrift connect github                GitHub (repos, issues, PRs, actions)

antidrift version                       Show version
antidrift help                          Show help
```

### Platform targeting

```bash
antidrift connect google --cowork       Claude Cowork / Desktop
antidrift connect google --all          All detected platforms
antidrift connect google --claude-code  Claude Code (default)
```

## Skill Packs

```bash
antidrift skills add essentials         # decision, recap, write, prep, followup, status, search
antidrift skills add engineering        # review, spec, changelog, standards, tps
antidrift skills add customer-research  # icp, voc, twins
antidrift skills add security           # audit, threat-model, pentest-prep, incident, secrets
antidrift skills add legal              # legal document generator
```

## Supported Platforms

| Platform | Brain File | Config |
|---|---|---|
| Claude Code | CLAUDE.md | .mcp.json |
| Claude Cowork / Desktop | CLAUDE.md | claude_desktop_config.json |
| OpenAI Codex | AGENTS.md | — |
| Cursor | AGENTS.md | — |
| Google Antigravity | GEMINI.md | — |

## Learn More

[antidrift.io](https://antidrift.io)

Built by [Probeo.io](https://probeo.io)
