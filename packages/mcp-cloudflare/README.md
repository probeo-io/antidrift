# @antidrift/mcp-cloudflare

Cloudflare connector for [antidrift](https://antidrift.io) — DNS, Pages, Workers, R2.

## Install

```bash
npx @antidrift/cli connect cloudflare
```

## Tools (12)

### DNS
- `cf_list_zones` — list domains/zones
- `cf_list_dns_records` — list records with type filter
- `cf_create_dns_record` — create A, CNAME, MX, TXT, etc.
- `cf_delete_dns_record` — delete a record

### Pages
- `cf_list_pages_projects` — list Pages projects
- `cf_get_pages_project` — details, build config, domains, latest deploy
- `cf_list_pages_deployments` — recent deployments with commit messages

### Workers
- `cf_list_workers` — list Worker scripts
- `cf_get_worker` — metadata, bindings, compat date

### R2
- `cf_list_r2_buckets` — list storage buckets
- `cf_create_r2_bucket` — create a bucket with location hint
- `cf_delete_r2_bucket` — delete an empty bucket

## Auth

API token. Create one at https://dash.cloudflare.com/profile/api-tokens.

## License

MIT
