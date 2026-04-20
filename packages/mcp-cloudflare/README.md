# @antidrift/mcp-cloudflare

Cloudflare MCP server for [antidrift](https://antidrift.io) — DNS, Pages, Workers, and R2 from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect cloudflare
```

You'll be prompted for your Cloudflare API token. Create one at [Cloudflare Dashboard > Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens).

Credentials are stored locally at `~/.antidrift/cloudflare.json`.

## Tools (12)

### DNS (4)

| Tool | Description |
|---|---|
| `cf_list_zones` | List domains/zones |
| `cf_list_dns_records` | List records with type filter |
| `cf_create_dns_record` | Create A, CNAME, MX, TXT, etc. |
| `cf_delete_dns_record` | Delete a record |

### Pages (3)

| Tool | Description |
|---|---|
| `cf_list_pages_projects` | List Pages projects |
| `cf_get_pages_project` | Details, build config, domains, latest deploy |
| `cf_list_pages_deployments` | Recent deployments with commit messages |

### Workers (2)

| Tool | Description |
|---|---|
| `cf_list_workers` | List Worker scripts |
| `cf_get_worker` | Metadata, bindings, compat date |

### R2 (3)

| Tool | Description |
|---|---|
| `cf_list_r2_buckets` | List storage buckets |
| `cf_create_r2_bucket` | Create a bucket with location hint |
| `cf_delete_r2_bucket` | Delete an empty bucket |

## Platform support

```bash
antidrift connect cloudflare          # global install (default)
antidrift connect cloudflare --cowork      # also register with Claude Desktop
antidrift connect cloudflare --local    # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/cloudflare.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
