# antidrift

Open source company brain for AI coding tools. One repo your whole team shares — context, skills, and connected services.

Works with Claude Code, Claude Cowork / Desktop, OpenAI Codex, Cursor, and Google Antigravity.

## Install

```bash
npm install -g @antidrift/cli
```

Or via Python:

```bash
pip install antidrift
```

Works on macOS, Linux, and Windows (CMD, PowerShell, Git Bash).

## Quick start

```bash
antidrift init
```

## Commands

| Command | What it does |
|---|---|
| `antidrift init` | Start a new brain |
| `antidrift join <repo>` | Join an existing brain |
| `antidrift update` | Update core skills and sync brain files |
| `antidrift skills list` | Browse community skills by pack |
| `antidrift skills add <name\|pack>` | Install skills |
| `antidrift skills add --all` | Install all community skills |
| `antidrift skills remove <name>` | Remove a skill |
| `antidrift cross-compile <path> --to <claude\|codex>` | Convert skills between platforms |
| `antidrift connect <service>` | Connect an MCP service |
| `antidrift version` | Show version |
| `antidrift help` | Show help |

## Skill packs

```bash
antidrift skills add essentials         # decision, recap, write, prep, followup, status, search
antidrift skills add engineering        # review, spec, changelog, standards, tps
antidrift skills add customer-research  # icp, voc, twins
antidrift skills add security           # audit, threat-model, pentest-prep, incident, secrets
antidrift skills add legal              # legal document generator
```

## Connect services

```bash
antidrift connect google                # Google Workspace (Sheets, Docs, Drive, Gmail, Calendar)
antidrift connect gmail                 # Gmail only (14 tools)
antidrift connect drive                 # Drive, Docs, Sheets (19 tools)
antidrift connect calendar              # Calendar only (4 tools)
antidrift connect stripe                # Stripe (17 tools)
antidrift connect attio                 # Attio CRM (14 tools)
antidrift connect github                # GitHub (15 tools)
antidrift connect hubspot-crm           # HubSpot CRM (21 tools)
antidrift connect hubspot-marketing     # HubSpot Marketing (10 tools)
antidrift connect jira                  # Jira (15 tools)
antidrift connect linear                # Linear (12 tools)
antidrift connect clickup               # ClickUp (12 tools)
antidrift connect notion                # Notion (9 tools)
antidrift connect pipedrive             # Pipedrive (15 tools)
antidrift connect aws                   # AWS (15 tools)
antidrift connect cloudflare            # Cloudflare (12 tools)
antidrift connect vercel                # Vercel (9 tools)
antidrift connect netlify               # Netlify (10 tools)
```

Platform targeting:

```bash
antidrift connect google --cowork       # Claude Cowork / Desktop
antidrift connect google --all          # All detected platforms
```

## Supported platforms

| Platform | Brain File | Config |
|---|---|---|
| Claude Code | CLAUDE.md | .mcp.json |
| Claude Cowork / Desktop | CLAUDE.md | claude_desktop_config.json |
| OpenAI Codex | AGENTS.md | — |
| Cursor | AGENTS.md | — |
| Google Antigravity | GEMINI.md | — |

## License

MIT — [antidrift.io](https://antidrift.io)
