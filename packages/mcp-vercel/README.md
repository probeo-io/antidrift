# @antidrift/mcp-vercel

Claude can't see your Vercel deployments. Connect it and you can check deploy status, read build logs, and manage env vars without opening the dashboard.

- "What's the status of the last deployment for my-app?"
- "Show me the build logs for the failed deploy"
- "Add a NEXT_PUBLIC_API_URL env var to production"

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
antidrift connect vercel               # global install (default)
antidrift connect vercel --local        # local project only
antidrift connect vercel --cowork      # also register with Claude Desktop
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/vercel.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
