# @antidrift/mcp-clickup

ClickUp connector for [antidrift](https://antidrift.io) — workspaces, spaces, tasks, and comments for your AI agents.

## Install

```bash
npx @antidrift/mcp-clickup
```

Or via the antidrift CLI:

```bash
antidrift connect clickup
```

### Platform flags

```bash
antidrift connect clickup --claude-code   # Claude Code only
antidrift connect clickup --cowork        # Claude Desktop / Cowork only
antidrift connect clickup --all           # All detected platforms
```

## Getting your API token

1. Go to ClickUp → Settings → Apps
2. Click "API Token"
3. Copy your personal API token
4. Paste it when prompted during setup

## Tools

| Tool | Description |
|---|---|
| `clickup_list_workspaces` | List all workspaces (teams) |
| `clickup_list_spaces` | List spaces in a workspace |
| `clickup_list_folders` | List folders in a space |
| `clickup_list_lists` | List lists in a folder or space |
| `clickup_list_tasks` | List tasks in a list (with optional status/assignee filters) |
| `clickup_get_task` | Get task details + comments |
| `clickup_create_task` | Create a task (name, description, priority, assignees, due date, tags) |
| `clickup_update_task` | Update a task (name, description, status, priority, assignees, due date) |
| `clickup_add_comment` | Add a comment to a task |
| `clickup_search_tasks` | Search tasks across a workspace |
| `clickup_list_statuses` | List available statuses for a list |
| `clickup_move_task` | Move a task to a different status |

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, Google, etc.) as part of your conversation. Do not connect services containing data you are not comfortable sharing.

## Commands

```bash
antidrift connect clickup          # Connect / setup
antidrift connect clickup status   # Check connection
antidrift connect clickup reset    # Clear credentials
```

## License

MIT — Built by [Probeo.io](https://probeo.io)
