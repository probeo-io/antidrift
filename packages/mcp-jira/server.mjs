#!/usr/bin/env node

import { createInterface } from 'readline';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const allTools = [];

if (existsSync(join(homedir(), '.antidrift', 'jira.json'))) {
  const { tools } = await import('./connectors/jira.mjs');
  allTools.push(...tools);
}

const rl = createInterface({ input: process.stdin, terminal: false });

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }

  const { id, method, params } = req;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'antidrift-jira', version: '0.10.0' }
      }
    });
  } else if (method === 'notifications/initialized') {
    // no response needed
  } else if (method === 'tools/list') {
    send({
      jsonrpc: '2.0', id,
      result: {
        tools: allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }))
      }
    });
  } else if (method === 'tools/call') {
    const tool = allTools.find(t => t.name === params.name);
    if (!tool) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${params.name}` } });
      return;
    }

    try {
      const result = await tool.handler(params.arguments || {});
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
    } catch (err) {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } });
    }
  } else {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } });
  }
});
