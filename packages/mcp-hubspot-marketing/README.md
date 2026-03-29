# @antidrift/mcp-hubspot-marketing

HubSpot Marketing connector for [antidrift](https://antidrift.io) — emails, campaigns, forms, landing pages, and blog posts for your AI agents.

## Install

```bash
npx antidrift connect hubspot-marketing
```

Or with platform targeting:

```bash
npx @antidrift/mcp-hubspot-marketing --claude-code
npx @antidrift/mcp-hubspot-marketing --cowork
npx @antidrift/mcp-hubspot-marketing --all
```

## Authentication

This connector shares credentials with `@antidrift/mcp-hubspot-crm`. Both use `~/.antidrift/hubspot.json`.

1. Go to **HubSpot > Settings > Integrations > Private Apps**
2. Create a private app (or use your existing one from hubspot-crm)
3. Under **Scopes**, add:
   - `marketing-email`
   - `marketing.campaigns.read`
   - `marketing.campaigns.write`
4. Copy the access token

The token is stored in `~/.antidrift/hubspot.json`.

## Tools

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

## Commands

```bash
antidrift connect hubspot-marketing            # Connect
antidrift connect hubspot-marketing status     # Check status
antidrift connect hubspot-marketing reset      # Clear credentials
```

## Privacy

By installing this connector, you acknowledge that data accessed through it will be sent to your AI model provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.

## API

Uses HubSpot Marketing API v3 and CMS API v3. No external dependencies — pure `fetch`.

Built by [Probeo.io](https://probeo.io) — https://antidrift.io
