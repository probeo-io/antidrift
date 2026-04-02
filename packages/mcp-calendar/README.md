# @antidrift/mcp-calendar

Google Calendar MCP server for [antidrift](https://antidrift.io) — view, search, and create calendar events from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect calendar
```

A browser window opens for Google sign-in. The OAuth token is stored locally at `~/.antidrift/google.json`.

Required scope: Calendar (read/write).

## Tools (4)

| Tool | Description |
|---|---|
| `calendar_today` | List today's events |
| `calendar_upcoming` | List upcoming events |
| `calendar_search` | Search events by query |
| `calendar_create` | Create a new event |

## Platform support

```bash
antidrift connect calendar            # Claude Code (default)
antidrift connect calendar --cowork   # Claude Desktop / Cowork
antidrift connect calendar --all      # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/google.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
