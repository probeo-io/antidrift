# @antidrift/mcp-clickup

ClickUp MCP server for [antidrift](https://antidrift.io) — workspaces, spaces, tasks, and comments from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect clickup
```

You'll be prompted for your ClickUp API token. Get one from ClickUp > Settings > Apps > API Token.

Credentials are stored locally at `~/.antidrift/clickup.json`.

## Tools (12)

| Tool | Description |
|---|---|
| `clickup_list_workspaces` | List all workspaces (teams) |
| `clickup_list_spaces` | List spaces in a workspace |
| `clickup_list_folders` | List folders in a space |
| `clickup_list_lists` | List lists in a folder or space |
| `clickup_list_tasks` | List tasks in a list (optional status/assignee filters) |
| `clickup_get_task` | Get task details and comments |
| `clickup_create_task` | Create a task (name, description, priority, assignees, due date, tags) |
| `clickup_update_task` | Update a task (name, description, status, priority, assignees, due date) |
| `clickup_add_comment` | Add a comment to a task |
| `clickup_search_tasks` | Search tasks across a workspace |
| `clickup_list_statuses` | List available statuses for a list |
| `clickup_move_task` | Move a task to a different status |

## Platform support

```bash
antidrift connect clickup             # Claude Code (default)
antidrift connect clickup --cowork    # Claude Desktop / Cowork
antidrift connect clickup --all       # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/clickup.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
