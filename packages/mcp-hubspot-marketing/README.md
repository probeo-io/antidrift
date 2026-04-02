# @antidrift/mcp-hubspot-marketing

HubSpot Marketing MCP server for [antidrift](https://antidrift.io) — emails, campaigns, forms, landing pages, and blog posts from Claude Code, Codex, and other AI agents.

> For CRM tools (contacts, companies, deals), see [`@antidrift/mcp-hubspot-crm`](https://www.npmjs.com/package/@antidrift/mcp-hubspot-crm). Both share the same credentials.

## Setup

```bash
antidrift connect hubspot-marketing
```

You'll need a HubSpot private app access token:

1. Go to **HubSpot > Settings > Integrations > Private Apps**
2. Create a private app (or use your existing one from hubspot-crm)
3. Under **Scopes**, add: `marketing-email`, `marketing.campaigns.read`, `marketing.campaigns.write`
4. Copy the access token

Credentials are stored locally at `~/.antidrift/hubspot.json`.

## Tools (10)

| Tool | Description |
|---|---|
| `hubspot_list_marketing_emails` | List marketing emails |
| `hubspot_get_marketing_email` | Get email details and stats by ID |
| `hubspot_list_campaigns` | List marketing campaigns |
| `hubspot_get_campaign` | Get campaign details by ID |
| `hubspot_list_forms` | List forms |
| `hubspot_get_form` | Get form details by ID |
| `hubspot_get_form_submissions` | Get submissions for a form |
| `hubspot_list_landing_pages` | List landing pages |
| `hubspot_list_blog_posts` | List blog posts |
| `hubspot_get_blog_post` | Get blog post details by ID |

## Platform support

```bash
antidrift connect hubspot-marketing         # Claude Code (default)
antidrift connect hubspot-marketing --cowork # Claude Desktop / Cowork
antidrift connect hubspot-marketing --all   # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/hubspot.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
