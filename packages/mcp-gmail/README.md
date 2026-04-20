# @antidrift/mcp-gmail

Gmail MCP server for [antidrift](https://antidrift.io) — search, read, send, label, and archive emails from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect gmail
```

A browser window opens for Google sign-in. The OAuth token is stored locally at `~/.antidrift/google.json`.

Required scope: `gmail.modify` (read, send, label, archive — no permanent delete).

## Tools (14)

| Tool | Description |
|---|---|
| `gmail_search` | Search messages by query |
| `gmail_read` | Read a message by ID |
| `gmail_send` | Send an email |
| `gmail_reply` | Reply to a message |
| `gmail_create_draft` | Create a draft message |
| `gmail_list_drafts` | List draft messages |
| `gmail_list_labels` | List all labels |
| `gmail_create_label` | Create a new label |
| `gmail_add_label` | Add a label to a message |
| `gmail_remove_label` | Remove a label from a message |
| `gmail_archive` | Archive a message (remove from inbox) |
| `gmail_trash` | Move a message to trash |
| `gmail_mark_read` | Mark a message as read |
| `gmail_mark_unread` | Mark a message as unread |

## Platform support

```bash
antidrift connect gmail               # global install (default)
antidrift connect gmail --cowork      # also register with Claude Desktop
antidrift connect gmail --local         # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/google.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
