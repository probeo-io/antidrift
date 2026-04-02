# @antidrift/mcp-vercel

Vercel MCP server for [antidrift](https://antidrift.io) — projects, deployments, domains, and environment variables from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect vercel
```

You'll be prompted for your Vercel personal access token. Create one at [Vercel Account Settings > Tokens](https://vercel.com/account/tokens).

Credentials are stored locally at `~/.antidrift/vercel.json`.

## Tools (9)

### Projects (2)

| Tool | Description |
|---|---|
| `vercel_list_projects` | All projects with framework |
| `vercel_get_project` | Details, repo link, production URL |

### Deployments (4)

| Tool | Description |
|---|---|
| `vercel_list_deployments` | Recent deploys with status and commit message |
| `vercel_get_deployment` | Full deploy details |
| `vercel_redeploy` | Trigger a redeployment |
| `vercel_get_deployment_events` | Build logs |

### Domains (1)

| Tool | Description |
|---|---|
| `vercel_list_domains` | Domains for a project |

### Environment Variables (2)

| Tool | Description |
|---|---|
| `vercel_list_env_vars` | List env vars with targets |
| `vercel_create_env_var` | Create/update env var for production/preview/dev |

## Platform support

```bash
antidrift connect vercel              # Claude Code (default)
antidrift connect vercel --cowork     # Claude Desktop / Cowork
antidrift connect vercel --all        # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/vercel.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
