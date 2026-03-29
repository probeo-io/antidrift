#!/usr/bin/env node

import { createInterface } from 'readline';
import { tools as awsTools } from './connectors/aws.mjs';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const allTools = [];

// Check that aws.json config exists AND that aws CLI is available
const hasConfig = existsSync(join(homedir(), '.antidrift', 'aws.json'));
let hasAwsCli = false;
try {
  execSync('which aws', { encoding: 'utf8', stdio: 'pipe' });
  hasAwsCli = true;
} catch {}

if (hasConfig && hasAwsCli) {
  allTools.push(...awsTools);
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
        serverInfo: { name: 'antidrift-aws', version: '0.10.0' }
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
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] } });
    } catch (err) {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } });
    }
  } else {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } });
  }
});
