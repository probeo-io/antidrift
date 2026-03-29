# @antidrift/mcp-google

Google Workspace MCP server for antidrift. Gives your AI agent live access to Sheets, Docs, Drive, Gmail, and Calendar.

## Install

```bash
antidrift connect google
```

## Tools

| Tool | Description |
|---|---|
| `list_spreadsheets` | List spreadsheets in Google Drive |
| `read_sheet` | Read data from a spreadsheet range |
| `write_sheet` | Write data to a spreadsheet range |
| `append_sheet` | Append rows to a spreadsheet |
| `get_sheet_info` | Get spreadsheet metadata and sheet names |
| `create_doc` | Create a new Google Doc |
| `read_doc` | Read content from a Google Doc |
| `append_to_doc` | Append content to a Google Doc |
| `write_doc` | Replace content in a Google Doc |
| `list_docs` | List Google Docs in Drive |
| `share_doc` | Share a Google Doc with a user |
| `drive_list_files` | List files in Google Drive |
| `drive_list_folders` | List folders in Google Drive |
| `drive_get_file_info` | Get metadata for a Drive file |
| `drive_download` | Download a file from Drive |
| `drive_share` | Share a Drive file with a user |
| `drive_create_folder` | Create a folder in Drive |
| `drive_move_file` | Move a file to a different folder |
| `gmail_search` | Search Gmail messages |
| `gmail_read` | Read a Gmail message by ID |
| `gmail_send` | Send an email via Gmail |
| `gmail_reply` | Reply to a Gmail message |
| `calendar_upcoming` | List upcoming calendar events |
| `calendar_search` | Search calendar events |
| `calendar_create` | Create a calendar event |
| `calendar_today` | List today's calendar events |

## Auth

Google OAuth with loopback redirect. When you run `antidrift connect google`, a browser window opens for Google sign-in. The token is stored at `~/.antidrift/google.json`.

Required scopes: Sheets, Docs, Drive, Gmail (send/read), Calendar.

## Platform support

```bash
antidrift connect google                # Claude Code (default)
antidrift connect google --cowork       # Claude Cowork / Desktop
antidrift connect google --all          # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
