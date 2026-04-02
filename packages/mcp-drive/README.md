# @antidrift/mcp-drive

Google Drive, Docs, and Sheets MCP server for [antidrift](https://antidrift.io) — read, write, and organize files, documents, and spreadsheets from Claude Code, Codex, and other AI agents.

> Prefer this package if you need Drive + Docs + Sheets without Gmail/Calendar. For the full Google Workspace bundle, use [`@antidrift/mcp-google`](https://www.npmjs.com/package/@antidrift/mcp-google).

## Setup

```bash
antidrift connect drive
```

A browser window opens for Google sign-in. The OAuth token is stored locally at `~/.antidrift/google.json`.

Required scopes: Drive (read/write), Docs, Sheets.

## Tools (19)

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

### Sheets (5)

| Tool | Description |
|---|---|
| `list_spreadsheets` | List spreadsheets |
| `get_sheet_info` | Get spreadsheet metadata and sheet names |
| `read_sheet` | Read data from a range |
| `write_sheet` | Write data to a range |
| `append_sheet` | Append rows |

## Platform support

```bash
antidrift connect drive               # Claude Code (default)
antidrift connect drive --cowork      # Claude Desktop / Cowork
antidrift connect drive --all         # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/google.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
