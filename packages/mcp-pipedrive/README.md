# @antidrift/mcp-pipedrive

Pipedrive CRM connector for [antidrift](https://antidrift.io) — deals, contacts, organizations, activities, and notes.

## Install

```bash
npx @antidrift/cli connect pipedrive
```

## Tools (15)

### Deals
- `pipedrive_list_deals` — list deals with status filter
- `pipedrive_get_deal` — full deal details
- `pipedrive_create_deal` — create with title, value, contact, org
- `pipedrive_update_deal` — modify fields, change stage/status
- `pipedrive_search_deals` — search by title

### Contacts
- `pipedrive_list_persons` — list contacts
- `pipedrive_get_person` — full contact details
- `pipedrive_create_person` — create with name, email, phone, org
- `pipedrive_search_persons` — search by name, email, phone

### Organizations
- `pipedrive_list_organizations` — list organizations
- `pipedrive_create_organization` — create with name, address

### Activities
- `pipedrive_list_activities` — list calls, meetings, tasks, emails
- `pipedrive_create_activity` — create with type, subject, due date

### Notes & Pipelines
- `pipedrive_add_note` — add a note to a deal, person, or org
- `pipedrive_list_pipelines` — list pipelines with stages

## Auth

Personal API token. Go to Pipedrive → Settings → Personal preferences → API.

## License

MIT
