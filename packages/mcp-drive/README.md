# @antidrift/mcp-drive

Google Drive, Docs, and Sheets MCP server for antidrift. Gives your AI agent access to files, documents, and spreadsheets in Google Drive.

## Install

```bash
antidrift connect drive
```

## Tools

### Drive

| Tool | Description |
|---|---|
| `drive_list_files` | List files in Google Drive |
| `drive_list_folders` | List folders in Google Drive |
| `drive_get_file_info` | Get metadata for a Drive file |
| `drive_download` | Download a file from Drive |
| `drive_share` | Share a Drive file with a user |
| `drive_create_folder` | Create a folder in Drive |
| `drive_move_file` | Move a file to a different folder |

### Docs

| Tool | Description |
|---|---|
| `create_doc` | Create a new Google Doc |
| `read_doc` | Read content from a Google Doc |
| `append_to_doc` | Append content to a Google Doc |
| `write_doc` | Replace content in a Google Doc |
| `request_signature` | Request a signature on a Google Doc |
| `list_docs` | List Google Docs in Drive |
| `share_doc` | Share a Google Doc with a user |

### Sheets

| Tool | Description |
|---|---|
| `list_spreadsheets` | List spreadsheets in Google Drive |
| `read_sheet` | Read data from a spreadsheet range |
| `write_sheet` | Write data to a spreadsheet range |
| `append_sheet` | Append rows to a spreadsheet |
| `get_sheet_info` | Get spreadsheet metadata and sheet names |

19 tools total.

## Auth

Google OAuth with loopback redirect. When you run `antidrift connect drive`, a browser window opens for Google sign-in. The token is stored at `~/.antidrift/google.json`.

Required scopes: Drive (read/write), Docs, Sheets.

## Privacy

This MCP server accesses your Google Drive, Docs, and Sheets. File contents are only read when you explicitly request them. No data is sent to third parties — all processing happens locally through the MCP protocol.

## Platform support

```bash
antidrift connect drive                 # Claude Code (default)
antidrift connect drive --cowork        # Claude Cowork / Desktop
antidrift connect drive --all           # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
