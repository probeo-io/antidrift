# @antidrift/mcp-linear

Linear MCP server for [antidrift](https://antidrift.io) — issues, projects, cycles, teams, and comments from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect linear
```

You'll be prompted for your Linear API key. Create one at Linear > Settings > Account > API.

Credentials are stored locally at `~/.antidrift/linear.json`.

## Tools (12)

### Issues (6)

| Tool | Description |
|---|---|
| `linear_search_issues` | Filter by team, assignee, status, priority |
| `linear_get_issue` | Full details with comments |
| `linear_create_issue` | Create with title, team, description, priority, assignee |
| `linear_update_issue` | Modify any field |
| `linear_change_status` | Move between states (Todo, In Progress, Done) |
| `linear_assign_issue` | Assign or reassign |

### Projects (2)

| Tool | Description |
|---|---|
| `linear_list_projects` | All projects with status and progress |
| `linear_get_project` | Details with linked issues |

### Cycles (1)

| Tool | Description |
|---|---|
| `linear_current_cycle` | Active sprint for a team with all issues |

### Teams (1)

| Tool | Description |
|---|---|
| `linear_list_teams` | All teams in your workspace |

### Other (2)

| Tool | Description |
|---|---|
| `linear_add_comment` | Add a comment to an issue |
| `linear_search` | Full-text search across all issues |

## Platform support

```bash
antidrift connect linear              # Claude Code (default)
antidrift connect linear --cowork     # Claude Desktop / Cowork
antidrift connect linear --all        # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/linear.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
