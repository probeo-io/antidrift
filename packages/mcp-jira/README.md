# @antidrift/mcp-jira

Claude can't see your backlog. Connect Jira and it can search issues, create tickets from a conversation, and check sprint status — without leaving the terminal.

- "What tickets are in the current sprint?"
- "Create a bug ticket for the payment flow crash, high priority"
- "What's assigned to me that's still in progress?"

## Setup

```bash
antidrift connect jira
```

You'll need:

1. **Atlassian domain** — e.g. `mycompany` for `mycompany.atlassian.net`
2. **Email address** — your Atlassian account email
3. **API token** — create one at [Manage API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

Credentials are stored locally at `~/.antidrift/jira.json`.

## Tools (15)

| Tool | Description |
|---|---|
| `jira_list_projects` | List all projects |
| `jira_get_project` | Get project details |
| `jira_search_issues` | Search issues with JQL |
| `jira_get_issue` | Get issue details and comments |
| `jira_create_issue` | Create a new issue |
| `jira_update_issue` | Update issue fields |
| `jira_transition_issue` | Move issue to a new status |
| `jira_add_comment` | Add a comment to an issue |
| `jira_assign_issue` | Assign issue to a user |
| `jira_list_statuses` | List statuses for a project |
| `jira_list_users` | List assignable users |
| `jira_list_sprints` | List sprints for a board |
| `jira_list_boards` | List boards |
| `jira_list_issue_types` | List issue types for a project |
| `jira_my_issues` | Get issues assigned to current user |

## Platform support

```bash
antidrift connect jira                # global install (default)
antidrift connect jira --cowork      # also register with Claude Desktop
antidrift connect jira --local          # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/jira.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
