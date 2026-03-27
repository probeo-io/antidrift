# @antidrift/mcp-calendar

Google Calendar MCP server for antidrift. Gives your AI agent access to your calendar for viewing, searching, and creating events.

## Install

```bash
antidrift connect calendar
```

## Tools

| Tool | Description |
|---|---|
| `calendar_upcoming` | List upcoming calendar events |
| `calendar_search` | Search calendar events by query |
| `calendar_create` | Create a calendar event |
| `calendar_today` | List today's calendar events |

4 tools total.

## Auth

Google OAuth with loopback redirect. When you run `antidrift connect calendar`, a browser window opens for Google sign-in. The token is stored at `~/.antidrift/google.json`.

Required scope: Calendar (read/write).

## Privacy

This MCP server accesses your Google Calendar. Event details are only read when you explicitly request them. No data is sent to third parties — all processing happens locally through the MCP protocol.

## Platform support

```bash
antidrift connect calendar              # Claude Code (default)
antidrift connect calendar --cowork     # Claude Cowork / Desktop
antidrift connect calendar --all        # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
