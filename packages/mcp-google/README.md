# @antidrift/mcp-google

All-in-one Google Workspace MCP server for [antidrift](https://antidrift.io) — Sheets, Docs, Drive, Gmail, and Calendar in a single connector for Claude Code, Codex, and other AI agents.

> This is the bundle. If you only need a subset, install the standalone packages: [`mcp-gmail`](https://www.npmjs.com/package/@antidrift/mcp-gmail), [`mcp-drive`](https://www.npmjs.com/package/@antidrift/mcp-drive), [`mcp-calendar`](https://www.npmjs.com/package/@antidrift/mcp-calendar).

## Setup

```bash
antidrift connect google
```

A browser window opens for Google sign-in. The OAuth token is stored locally at `~/.antidrift/google.json`.

Required scopes: Sheets, Docs, Drive, Gmail (send/read), Calendar.

## Tools (30)

### Drive (7)

| Tool | Description |
|---|---|
| `drive_list_files` | List files |
| `drive_list_folders` | List folders |
| `drive_get_file_info` | Get file metadata |
| `drive_download` | Download a file |
| `drive_share` | Share a file with a user |
| `drive_create_folder` | Create a folder |
| `drive_move_file` | Move a file to a different folder |

### Docs (6)

| Tool | Description |
|---|---|
| `list_docs` | List Google Docs |
| `create_doc` | Create a new Doc |
| `read_doc` | Read content from a Doc |
| `write_doc` | Replace content in a Doc |
| `append_to_doc` | Append content to a Doc |
| `share_doc` | Share a Doc with a user |

### Sheets (7)

| Tool | Description |
|---|---|
| `list_spreadsheets` | List spreadsheets |
| `create_spreadsheet` | Create a new spreadsheet |
| `get_sheet_info` | Get spreadsheet metadata and sheet names |
| `read_sheet` | Read data from a range |
| `write_sheet` | Write data to a range |
| `append_sheet` | Append rows |
| `add_sheet` | Add a new sheet/tab to an existing spreadsheet |

### Gmail (14)

| Tool | Description |
|---|---|
| `gmail_search` | Search messages |
| `gmail_read` | Read a message by ID |
| `gmail_send` | Send an email |
| `gmail_reply` | Reply to a message |
| `gmail_create_draft` | Create a draft without sending |
| `gmail_list_drafts` | List drafts |
| `gmail_archive` | Archive a message |
| `gmail_trash` | Move a message to trash |
| `gmail_mark_read` | Mark a message as read |
| `gmail_mark_unread` | Mark a message as unread |
| `gmail_list_labels` | List all labels |
| `gmail_create_label` | Create a new label |
| `gmail_add_label` | Add a label to a message |
| `gmail_remove_label` | Remove a label from a message |

### Calendar (4)

| Tool | Description |
|---|---|
| `calendar_today` | List today's events |
| `calendar_upcoming` | List upcoming events |
| `calendar_search` | Search events by query |
| `calendar_create` | Create a new event |

## Platform support

```bash
antidrift connect google               # global install (default)
antidrift connect google --local        # local project only
antidrift connect google --cowork      # also register with Claude Desktop
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/google.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
