# @antidrift/api

Local MCP gateway for [antidrift](https://antidrift.io) — one HTTP endpoint for all your connected tools. Routes requests to the right MCP server so you can call any tool over HTTP instead of stdio.

## Setup

```bash
antidrift api start
```

Starts a local server that exposes all connected MCP tools via a single REST endpoint.

## How it works

The gateway discovers your connected services from `~/.antidrift/` and proxies tool calls to the appropriate MCP server. No cloud, no auth — everything runs locally.

## License

MIT — [antidrift.io](https://antidrift.io)
