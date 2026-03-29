#!/usr/bin/env node

/**
 * Antidrift MCP Gateway
 *
 * One HTTP endpoint that exposes all connected MCP tools.
 * Loads connectors dynamically based on what's configured in ~/.antidrift/
 *
 * Endpoints:
 *   GET  /tools          — list all available tools
 *   POST /tools/call     — call a tool { name, arguments }
 *   POST /mcp            — MCP JSON-RPC over HTTP (initialize, tools/list, tools/call)
 *   GET  /health         — health check
 */

import { createServer } from 'http';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const DEFAULT_PORT = 4242;

// ─── Load connectors ───────────────────────────────────────────────────────

const allTools = [];
const toolMap = new Map();

async function loadConnectors() {
  const connectors = [
    { name: 'github', config: 'github.json', module: '../mcp-github/connectors/github.mjs' },
    { name: 'attio', config: 'attio.json', module: '../mcp-attio/connectors/attio.mjs' },
    { name: 'clickup', config: 'clickup.json', module: '../mcp-clickup/connectors/clickup.mjs' },
    { name: 'jira', config: 'jira.json', module: '../mcp-jira/connectors/jira.mjs' },
    { name: 'notion', config: 'notion.json', module: '../mcp-notion/connectors/notion.mjs' },
    { name: 'stripe', config: 'stripe.json', module: '../mcp-stripe/connectors/stripe.mjs' },
    { name: 'hubspot', config: 'hubspot.json', module: '../mcp-hubspot-crm/connectors/hubspot-crm.mjs' },
    { name: 'hubspot-marketing', config: 'hubspot.json', module: '../mcp-hubspot-marketing/connectors/hubspot-marketing.mjs' },
    { name: 'gmail', config: 'credentials/google/token.json', module: '../mcp-gmail/connectors/google-gmail.mjs' },
    { name: 'drive', config: 'credentials/google/token.json', module: '../mcp-drive/connectors/google-drive.mjs' },
    { name: 'sheets', config: 'credentials/google/token.json', module: '../mcp-drive/connectors/google-sheets.mjs' },
    { name: 'docs', config: 'credentials/google/token.json', module: '../mcp-drive/connectors/google-docs.mjs' },
    { name: 'calendar', config: 'credentials/google/token.json', module: '../mcp-calendar/connectors/google-calendar.mjs' },
  ];

  for (const c of connectors) {
    const configPath = join(CONFIG_DIR, c.config);
    if (!existsSync(configPath)) continue;

    try {
      const mod = await import(c.module);
      const tools = mod.tools || [];
      for (const tool of tools) {
        allTools.push(tool);
        toolMap.set(tool.name, tool);
      }
      console.log(`  ✓ ${c.name} (${tools.length} tools)`);
    } catch (err) {
      console.log(`  ✗ ${c.name}: ${err.message}`);
    }
  }
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Health check
  if (path === '/health') {
    json(res, { status: 'ok', tools: allTools.length });
    return;
  }

  // List tools
  if (path === '/tools' && req.method === 'GET') {
    json(res, {
      tools: allTools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
    return;
  }

  // Call a tool
  if (path === '/tools/call' && req.method === 'POST') {
    const body = await parseBody(req);
    const { name, arguments: args } = body;

    if (!name) {
      json(res, { error: 'Missing tool name' }, 400);
      return;
    }

    const tool = toolMap.get(name);
    if (!tool) {
      json(res, { error: `Unknown tool: ${name}` }, 404);
      return;
    }

    try {
      const result = await tool.handler(args || {});
      json(res, { result });
    } catch (err) {
      json(res, { error: err.message }, 500);
    }
    return;
  }

  // MCP JSON-RPC over HTTP
  if (path === '/mcp' && req.method === 'POST') {
    const body = await parseBody(req);
    const { id, method, params } = body;

    if (method === 'initialize') {
      json(res, {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'antidrift-gateway', version: '0.10.0' },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      json(res, { jsonrpc: '2.0', id, result: {} });
      return;
    }

    if (method === 'tools/list') {
      json(res, {
        jsonrpc: '2.0', id,
        result: {
          tools: allTools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
      return;
    }

    if (method === 'tools/call') {
      const tool = toolMap.get(params?.name);
      if (!tool) {
        json(res, { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${params?.name}` } });
        return;
      }

      try {
        const result = await tool.handler(params?.arguments || {});
        json(res, {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] },
        });
      } catch (err) {
        json(res, {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true },
        });
      }
      return;
    }

    json(res, { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } });
    return;
  }

  // 404
  json(res, {
    error: 'Not found',
    endpoints: {
      'GET /health': 'Health check',
      'GET /tools': 'List all tools',
      'POST /tools/call': 'Call a tool { name, arguments }',
      'POST /mcp': 'MCP JSON-RPC over HTTP',
    },
  }, 404);
}

// ─── Start ──────────────────────────────────────────────────────────────────

export async function start(port = DEFAULT_PORT) {
  console.log(`
  ┌─────────────────────────────┐
  │  antidrift gateway          │
  │  MCP API                    │
  │                             │
  │  https://antidrift.io       │
  └─────────────────────────────┘

  Loading connectors...
`);

  await loadConnectors();

  console.log(`\n  ${allTools.length} tools loaded\n`);

  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.log(`  Gateway running at http://localhost:${port}`);
    console.log(`  MCP endpoint:      http://localhost:${port}/mcp`);
    console.log(`  Tools:             http://localhost:${port}/tools`);
    console.log(`  Health:            http://localhost:${port}/health\n`);
  });

  return server;
}
