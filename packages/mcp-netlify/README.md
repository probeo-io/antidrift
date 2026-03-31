# @antidrift/mcp-netlify

Netlify connector for [antidrift](https://antidrift.io) — sites, deploys, environment variables, forms.

## Install

```bash
npx @antidrift/cli connect netlify
```

## Tools (10)

### Sites
- `netlify_list_sites` — all sites with URLs
- `netlify_get_site` — details, repo, build settings

### Deploys
- `netlify_list_deploys` — recent deploys with status and build time
- `netlify_get_deploy` — full deploy details
- `netlify_rollback` — restore a previous deploy
- `netlify_trigger_build` — trigger a new build

### Environment Variables
- `netlify_list_env_vars` — list env vars with contexts
- `netlify_set_env_var` — create/update env var

### Forms
- `netlify_list_forms` — list forms with submission counts
- `netlify_list_submissions` — form submissions

## Auth

Personal access token. Create one at https://app.netlify.com/user/applications.

## License

MIT
