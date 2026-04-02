# @antidrift/mcp-hubspot-crm

HubSpot CRM MCP server for [antidrift](https://antidrift.io) — contacts, companies, deals, leads, and notes from Claude Code, Codex, and other AI agents.

> For marketing tools (emails, campaigns, forms, landing pages), see [`@antidrift/mcp-hubspot-marketing`](https://www.npmjs.com/package/@antidrift/mcp-hubspot-marketing). Both share the same credentials.

## Setup

```bash
antidrift connect hubspot-crm
```

You'll need a HubSpot private app access token:

1. Go to **HubSpot > Settings > Integrations > Private Apps**
2. Create a private app
3. Under **Scopes**, add: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.companies.read`, `crm.objects.companies.write`, `crm.objects.deals.read`, `crm.objects.deals.write`
4. Copy the access token

Credentials are stored locally at `~/.antidrift/hubspot.json`.

## Tools (21)

| Tool | Description |
|---|---|
| `hubspot_list_contacts` | List contacts, optionally search by query |
| `hubspot_get_contact` | Get contact details by ID |
| `hubspot_create_contact` | Create a new contact |
| `hubspot_update_contact` | Update contact properties |
| `hubspot_list_companies` | List companies, optionally search by query |
| `hubspot_get_company` | Get company details by ID |
| `hubspot_create_company` | Create a new company |
| `hubspot_update_company` | Update company properties |
| `hubspot_list_deals` | List deals, optionally search by query |
| `hubspot_get_deal` | Get deal details by ID |
| `hubspot_create_deal` | Create a new deal |
| `hubspot_update_deal` | Update deal properties |
| `hubspot_add_note` | Add a note to a contact, company, or deal |
| `hubspot_list_activities` | List recent notes for a record |
| `hubspot_search` | Search across contacts, companies, or deals |
| `hubspot_list_leads` | List leads |
| `hubspot_get_lead` | Get lead details by ID |
| `hubspot_create_lead` | Create a new lead |
| `hubspot_update_lead` | Update lead properties |
| `hubspot_list_forecasts` | List forecasts |
| `hubspot_list_line_items` | List line items |

## Platform support

```bash
antidrift connect hubspot-crm         # Claude Code (default)
antidrift connect hubspot-crm --cowork # Claude Desktop / Cowork
antidrift connect hubspot-crm --all   # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/hubspot.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
