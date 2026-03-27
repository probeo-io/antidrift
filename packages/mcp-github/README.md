# @antidrift/mcp-github

GitHub MCP server for antidrift. Gives your AI agent live access to repositories, issues, pull requests, actions, releases, and more.

## Install

```bash
antidrift connect github
```

You will be prompted for a GitHub Personal Access Token (PAT). The token is stored at `~/.antidrift/github.json`.

## Tools (15)

| Tool | Description |
|---|---|
| `github_user` | Get the authenticated user's info |
| `github_list_repos` | List repos for the authenticated user or an org |
| `github_search_repos` | Search GitHub repositories |
| `github_get_repo` | Get detailed info about a repository |
| `github_list_issues` | List issues for a repository |
| `github_get_issue` | Get issue details and comments |
| `github_create_issue` | Create a new issue |
| `github_list_prs` | List pull requests for a repository |
| `github_get_pr` | Get PR details and files changed |
| `github_pr_diff` | Get the diff for a pull request |
| `github_list_runs` | List recent workflow runs (Actions) |
| `github_get_file` | Read a file from a repository |
| `github_list_branches` | List branches for a repository |
| `github_list_releases` | List releases for a repository |
| `github_repo_traffic` | Get clone and view traffic (requires push access) |

## Auth

Create a GitHub Personal Access Token (classic or fine-grained):

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token"
3. Select scopes: `repo`, `read:org`, `workflow` (for Actions access)
4. Copy the token and paste it when prompted by `antidrift connect github`

For fine-grained tokens, grant repository access and the following permissions: Contents (read), Issues (read/write), Pull requests (read), Actions (read), Metadata (read).

## Platform support

```bash
antidrift connect github                # Claude Code (default)
antidrift connect github --cowork       # Claude Cowork / Desktop
antidrift connect github --all          # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
