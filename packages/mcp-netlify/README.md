# @antidrift/mcp-netlify

Claude can't see your Netlify sites. Connect it and you can check deploy status, trigger builds, review form submissions, and manage env vars from the terminal.

- "What's the deploy status for my marketing site?"
- "Roll back the last deploy on the docs site"
- "Show me the contact form submissions from this week"

## Setup

```bash
antidrift connect netlify
```

You'll be prompted for your Netlify personal access token. Create one at [Netlify User Settings > Applications](https://app.netlify.com/user/applications).

Credentials are stored locally at `~/.antidrift/netlify.json`.

## Tools (10)

### Sites (2)

| Tool | Description |
|---|---|
| `netlify_list_sites` | All sites with URLs |
| `netlify_get_site` | Details, repo, build settings |

### Deploys (4)

| Tool | Description |
|---|---|
| `netlify_list_deploys` | Recent deploys with status and build time |
| `netlify_get_deploy` | Full deploy details |
| `netlify_rollback` | Restore a previous deploy |
| `netlify_trigger_build` | Trigger a new build |

### Environment Variables (2)

| Tool | Description |
|---|---|
| `netlify_list_env_vars` | List env vars with contexts |
| `netlify_set_env_var` | Create/update an env var |

### Forms (2)

| Tool | Description |
|---|---|
| `netlify_list_forms` | List forms with submission counts |
| `netlify_list_submissions` | Form submissions |

## Platform support

```bash
antidrift connect netlify             # global install (default)
antidrift connect netlify --cowork      # also register with Claude Desktop
antidrift connect netlify --local       # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/netlify.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
