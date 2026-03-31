# @antidrift/mcp-vercel

Vercel connector for [antidrift](https://antidrift.io) — deployments, projects, domains, environment variables.

## Install

```bash
npx @antidrift/cli connect vercel
```

## Tools (9)

### Projects
- `vercel_list_projects` — all projects with framework
- `vercel_get_project` — details, repo link, production URL

### Deployments
- `vercel_list_deployments` — recent deploys with status and commit message
- `vercel_get_deployment` — full deploy details
- `vercel_redeploy` — trigger a redeployment
- `vercel_get_deployment_events` — build logs

### Domains
- `vercel_list_domains` — domains for a project

### Environment Variables
- `vercel_list_env_vars` — list env vars with targets
- `vercel_create_env_var` — create/update env var for production/preview/dev

## Auth

Personal access token. Create one at https://vercel.com/account/tokens.

## License

MIT
