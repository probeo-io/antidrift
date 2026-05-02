# @antidrift/mcp-notion

Claude can't read your Notion docs. Connect it and you can ask questions about your knowledge base, pull database records, and search across your workspace.

- "What does our runbook say about deploying to production?"
- "Find the Q2 goals page and summarize the priorities"
- "Search for anything related to the onboarding flow"

> **Read-only** — this connector cannot create, update, or delete anything in Notion.

## Setup

```bash
antidrift connect notion
```

You'll need a Notion Internal Integration Token:

1. Go to [My Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the Internal Integration Token
4. Paste it when prompted during setup
5. In Notion, share the pages/databases you want accessible with your integration

Credentials are stored locally at `~/.antidrift/notion.json`.

## Tools (9)

| Tool | Description |
|---|---|
| `notion_search` | Search pages and databases |
| `notion_get_page` | Get page properties |
| `notion_get_page_content` | Get page content (blocks), recursively |
| `notion_list_databases` | List accessible databases |
| `notion_query_database` | Query a database with optional filter/sorts |
| `notion_get_database` | Get database schema and properties |
| `notion_list_users` | List workspace users |
| `notion_get_block` | Get a specific block |
| `notion_get_block_children` | Get children of a block |

## Platform support

```bash
antidrift connect notion               # global install (default)
antidrift connect notion --local        # local project only
antidrift connect notion --cowork      # also register with Claude Desktop
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/notion.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
