# @antidrift/mcp-gmail

Gmail MCP server for antidrift. Gives your AI agent access to Gmail for searching, reading, sending, labeling, and archiving emails.

## Install

```bash
antidrift connect gmail
```

## Tools

| Tool | Description |
|---|---|
| `gmail_search` | Search Gmail messages by query |
| `gmail_read` | Read a Gmail message by ID |
| `gmail_send` | Send an email |
| `gmail_reply` | Reply to a Gmail message |
| `gmail_list_labels` | List all Gmail labels |
| `gmail_create_label` | Create a new label |
| `gmail_add_label` | Add a label to a message |
| `gmail_remove_label` | Remove a label from a message |
| `gmail_archive` | Archive a message (remove from inbox) |
| `gmail_trash` | Move a message to trash |
| `gmail_mark_read` | Mark a message as read |
| `gmail_mark_unread` | Mark a message as unread |
| `gmail_list_drafts` | List draft messages |
| `gmail_create_draft` | Create a draft message |

14 tools total.

## Auth

Google OAuth with loopback redirect. When you run `antidrift connect gmail`, a browser window opens for Google sign-in. The token is stored at `~/.antidrift/google.json`.

Required scope: `gmail.modify` (read, send, label, archive — no permanent delete).

## Privacy

This MCP server accesses your Gmail account. Only metadata (sender, subject, labels) is used for classification by skills like `/inbox`. Email body content is only read when you explicitly ask to read a message. No data is sent to third parties — all processing happens locally through the MCP protocol.

## Platform support

```bash
antidrift connect gmail                 # Claude Code (default)
antidrift connect gmail --cowork        # Claude Cowork / Desktop
antidrift connect gmail --all           # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
