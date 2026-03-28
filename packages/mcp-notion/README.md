# @antidrift/mcp-notion

Read-only Notion connector for [antidrift](https://antidrift.io). Access your Notion pages, databases, and blocks from Claude Code, Codex, Cursor, and other AI agents.

**This connector is read-only** — it cannot create, update, or delete anything in Notion.

## Install

```bash
antidrift connect notion
```

Or directly:

```bash
npx @antidrift/mcp-notion
```

## Setup

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the Internal Integration Token
4. Run `antidrift connect notion` and paste it
5. In Notion, share the pages/databases you want accessible with your integration

## Tools

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

## Privacy

By installing this connector, you acknowledge that data accessed through it will be sent to your AI model provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.

No data is stored or transmitted to antidrift servers. Credentials are saved locally in `~/.antidrift/notion.json`.

## No dependencies

This package uses pure `fetch` with zero external dependencies.
