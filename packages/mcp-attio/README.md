# @antidrift/mcp-attio

Attio CRM MCP server for [antidrift](https://antidrift.io) — manage people, companies, deals, tasks, and notes from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect attio
```

You'll be prompted for your Attio API key. Get one from [Attio Settings > Developers > API keys](https://app.attio.com/settings/developers).

Required scopes: `record_permission:read_write`, `task_permission:read_write`, `note_permission:read_write`.

Credentials are stored locally at `~/.antidrift/attio.json`.

## Tools (17)

| Tool | Description |
|---|---|
| `attio_list_people` | List people |
| `attio_search_people` | Search people by name or email |
| `attio_get_person` | Get full details for a person |
| `attio_create_person` | Create a new person |
| `attio_list_companies` | List companies |
| `attio_search_companies` | Search companies by name or domain |
| `attio_create_company` | Create a new company |
| `attio_list_deals` | List deals in the pipeline |
| `attio_search_deals` | Search deals by name or stage |
| `attio_create_deal` | Create a new deal |
| `attio_delete_deal` | Delete a deal by record ID |
| `attio_update_record` | Update fields on a person, company, or deal |
| `attio_move_deal` | Move a deal to a different pipeline stage |
| `attio_create_task` | Create a task, optionally linked to a record |
| `attio_list_tasks` | List tasks |
| `attio_complete_task` | Mark a task as completed |
| `attio_add_note` | Add a note to a person or company |

## Platform support

```bash
antidrift connect attio               # global install (default)
antidrift connect attio --cowork      # also register with Claude Desktop
antidrift connect attio --local         # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/attio.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
