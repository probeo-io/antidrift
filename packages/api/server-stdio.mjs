#!/usr/bin/env node

/**
 * Antidrift MCP Shim (stdio → HTTP)
 *
 * Thin proxy that receives MCP JSON-RPC on stdin and forwards
 * to the antidrift HTTP gateway. No tool logic here — just transport.
 *
 * Usage in .mcp.json:
 *   { "command": "node", "args": ["server-stdio.mjs"] }
 *
 * Requires the gateway running at ANTIDRIFT_API_URL (default: http://localhost:4242)
 */

import { createInterface } from 'readline';

const API_URL = process.env.ANTIDRIFT_API_URL || 'http://localhost:4242';

const rl = createInterface({ input: process.stdin, terminal: false });

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }

  // Forward to HTTP gateway
  try {
    const res = await fetch(`${API_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: line,
    });

    const data = await res.json();
    send(data);
  } catch (err) {
    // Gateway not running or network error
    if (req.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32603, message: `Gateway not reachable at ${API_URL} — run: antidrift gateway` },
      });
    } else if (req.id) {
      send({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32603, message: `Gateway error: ${err.message}` },
      });
    }
  }
});
