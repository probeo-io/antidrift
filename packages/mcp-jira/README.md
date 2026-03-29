# @antidrift/mcp-jira

Jira connector for [antidrift](https://antidrift.io) — projects, issues, sprints, boards.

## Setup

```bash
npx antidrift connect jira
```

You will need:

1. **Atlassian domain** — e.g. `mycompany` for `mycompany.atlassian.net`
2. **Email address** — your Atlassian account email
3. **API token** — create one at https://id.atlassian.com/manage-profile/security/api-tokens

Credentials are stored locally in `~/.antidrift/jira.json`.

## Tools

| Tool | Description |
|------|-------------|
| `jira_list_projects` | List all projects |
| `jira_get_project` | Get project details |
| `jira_search_issues` | Search issues with JQL |
| `jira_get_issue` | Get issue details + comments |
| `jira_create_issue` | Create a new issue |
| `jira_update_issue` | Update issue fields |
| `jira_transition_issue` | Move issue to new status |
| `jira_add_comment` | Add comment to an issue |
| `jira_assign_issue` | Assign issue to a user |
| `jira_list_statuses` | List statuses for a project |
| `jira_list_users` | List assignable users |
| `jira_list_sprints` | List sprints for a board |
| `jira_get_board` | List boards |
| `jira_list_issue_types` | List issue types for a project |
| `jira_my_issues` | Get issues assigned to current user |

## Platform targeting

```bash
npx antidrift connect jira                 # Claude Code (default)
npx antidrift connect jira --cowork        # Claude Desktop / Cowork
npx antidrift connect jira --all           # All detected platforms
```

## Privacy

By installing this connector, you acknowledge that data accessed through it will be sent to your AI model provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.

## Commands

```bash
npx antidrift connect jira               # Connect
npx antidrift connect jira status        # Check status
npx antidrift connect jira reset         # Clear credentials
```
