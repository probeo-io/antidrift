# @antidrift/mcp-hubspot-crm

HubSpot CRM connector for [antidrift](https://antidrift.io) — contacts, companies, deals, and notes for your AI agents.

## Install

```bash
npx antidrift connect hubspot-crm
```

Or with platform targeting:

```bash
npx @antidrift/mcp-hubspot-crm --claude-code
npx @antidrift/mcp-hubspot-crm --cowork
npx @antidrift/mcp-hubspot-crm --all
```

## Authentication

1. Go to **HubSpot → Settings → Integrations → Private Apps**
2. Create a private app
3. Under **Scopes**, add:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
4. Copy the access token

The token is stored in `~/.antidrift/hubspot.json`.

## Tools

| Tool | Description |
|---|---|
| `hubspot_list_contacts` | List contacts, optionally search by query |
| `hubspot_get_contact` | Get full contact details by ID |
| `hubspot_create_contact` | Create a new contact |
| `hubspot_update_contact` | Update contact properties |
| `hubspot_list_companies` | List companies, optionally search by query |
| `hubspot_get_company` | Get full company details by ID |
| `hubspot_create_company` | Create a new company |
| `hubspot_update_company` | Update company properties |
| `hubspot_list_deals` | List deals, optionally search by query |
| `hubspot_get_deal` | Get full deal details by ID |
| `hubspot_create_deal` | Create a new deal |
| `hubspot_update_deal` | Update deal properties |
| `hubspot_add_note` | Add a note to a contact, company, or deal |
| `hubspot_list_activities` | List recent notes for a record |
| `hubspot_search` | Search across contacts, companies, or deals |

## Commands

```bash
antidrift connect hubspot-crm            # Connect
antidrift connect hubspot-crm status     # Check status
antidrift connect hubspot-crm reset      # Clear credentials
```

## Privacy

By installing this connector, you acknowledge that data accessed through it will be sent to your AI model provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.

## API

Uses HubSpot API v3 for CRM objects and v4 for associations. No external dependencies — pure `fetch`.

Built by [Probeo.io](https://probeo.io) — https://antidrift.io
