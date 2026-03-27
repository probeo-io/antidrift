# @antidrift/mcp-attio

Attio CRM MCP server for antidrift. Gives your AI agent live access to people, companies, deals, tasks, and notes.

## Install

```bash
antidrift connect attio
```

You will be prompted for your Attio API key. The key is stored at `~/.antidrift/attio.json`.

## Tools (14)

| Tool | Description |
|---|---|
| `attio_list_people` | List people in the CRM |
| `attio_search_people` | Search people by name or email |
| `attio_get_person` | Get full details for a person |
| `attio_create_person` | Create a new person |
| `attio_list_companies` | List companies in the CRM |
| `attio_search_companies` | Search companies by name or domain |
| `attio_create_company` | Create a new company |
| `attio_list_deals` | List deals in the pipeline |
| `attio_update_record` | Update fields on a person, company, or deal |
| `attio_move_deal` | Move a deal to a different pipeline stage |
| `attio_create_task` | Create a task, optionally linked to a record |
| `attio_list_tasks` | List tasks |
| `attio_complete_task` | Mark a task as completed |
| `attio_add_note` | Add a note to a person or company |

## Auth

Provide an Attio API key. Get one from [Attio Settings > Developers > API keys](https://app.attio.com/settings/developers).

Required scopes: `record_permission:read_write`, `task_permission:read_write`, `note_permission:read_write`.

## Platform support

```bash
antidrift connect attio                 # Claude Code (default)
antidrift connect attio --cowork        # Claude Cowork / Desktop
antidrift connect attio --all           # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
