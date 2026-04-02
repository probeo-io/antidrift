# @antidrift/mcp-pipedrive

Pipedrive CRM MCP server for [antidrift](https://antidrift.io) — deals, contacts, organizations, activities, and notes from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect pipedrive
```

You'll be prompted for your Pipedrive API token. Get one from Pipedrive > Settings > Personal preferences > API.

Credentials are stored locally at `~/.antidrift/pipedrive.json`.

## Tools (15)

### Deals (5)

| Tool | Description |
|---|---|
| `pipedrive_list_deals` | List deals with status filter |
| `pipedrive_get_deal` | Full deal details |
| `pipedrive_create_deal` | Create with title, value, contact, org |
| `pipedrive_update_deal` | Modify fields, change stage/status |
| `pipedrive_search_deals` | Search by title |

### Contacts (4)

| Tool | Description |
|---|---|
| `pipedrive_list_persons` | List contacts |
| `pipedrive_get_person` | Full contact details |
| `pipedrive_create_person` | Create with name, email, phone, org |
| `pipedrive_search_persons` | Search by name, email, phone |

### Organizations (2)

| Tool | Description |
|---|---|
| `pipedrive_list_organizations` | List organizations |
| `pipedrive_create_organization` | Create with name, address |

### Activities (2)

| Tool | Description |
|---|---|
| `pipedrive_list_activities` | List calls, meetings, tasks, emails |
| `pipedrive_create_activity` | Create with type, subject, due date |

### Notes & Pipelines (2)

| Tool | Description |
|---|---|
| `pipedrive_add_note` | Add a note to a deal, person, or org |
| `pipedrive_list_pipelines` | List pipelines with stages |

## Platform support

```bash
antidrift connect pipedrive           # Claude Code (default)
antidrift connect pipedrive --cowork  # Claude Desktop / Cowork
antidrift connect pipedrive --all     # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/pipedrive.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
