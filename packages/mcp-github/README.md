# @antidrift/mcp-github

GitHub MCP server for [antidrift](https://antidrift.io) — repos, issues, pull requests, Actions, releases, and traffic from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect github
```

You'll be prompted for a GitHub Personal Access Token (PAT).

**Classic token** — select scopes: `repo`, `read:org`, `workflow`.

**Fine-grained token** — grant repository access and permissions: Contents (read), Issues (read/write), Pull requests (read), Actions (read), Metadata (read).

Get one from [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

Credentials are stored locally at `~/.antidrift/github.json`.

## Tools (15)

| Tool | Description |
|---|---|
| `github_user` | Get the authenticated user's info |
| `github_list_repos` | List repos for a user or org |
| `github_search_repos` | Search GitHub repositories |
| `github_get_repo` | Get repository details |
| `github_list_issues` | List issues for a repo |
| `github_get_issue` | Get issue details and comments |
| `github_create_issue` | Create a new issue |
| `github_list_prs` | List pull requests for a repo |
| `github_get_pr` | Get PR details and files changed |
| `github_pr_diff` | Get the diff for a pull request |
| `github_list_runs` | List recent workflow runs (Actions) |
| `github_get_file` | Read a file from a repository |
| `github_list_branches` | List branches |
| `github_list_releases` | List releases |
| `github_repo_traffic` | Get clone and view traffic (requires push access) |

## Platform support

```bash
antidrift connect github              # Claude Code (default)
antidrift connect github --cowork     # Claude Desktop / Cowork
antidrift connect github --all        # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/github.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
