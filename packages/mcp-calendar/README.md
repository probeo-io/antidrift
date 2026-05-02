# @antidrift/mcp-calendar

Claude doesn't know what's on your schedule. Connect Google Calendar and it can plan around your day, find availability, and create events from a conversation.

- "What's on my schedule today?"
- "Do I have anything on Friday afternoon?"
- "Create a 30-minute call with the team next Tuesday at 2pm"

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
antidrift connect calendar            # global install (default)
antidrift connect calendar --cowork      # also register with Claude Desktop
antidrift connect calendar --local      # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/google.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
