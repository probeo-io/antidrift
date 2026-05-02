# @antidrift/mcp-pipedrive

Claude can't see your Pipedrive pipeline. Connect it and you can track deals, research contacts before calls, and log activity without switching tabs.

- "What deals are closing this month?"
- "Look up the contact at TechCorp and show me their recent activity"
- "Add a note to the Acme deal — they want a revised proposal by Friday"

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
antidrift connect pipedrive           # global install (default)
antidrift connect pipedrive --cowork      # also register with Claude Desktop
antidrift connect pipedrive --local     # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/pipedrive.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
