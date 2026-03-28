import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';

const SERVER_PATH = join(import.meta.dirname, '..', 'server.mjs');
const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'github.json');
const BACKUP_PATH = CONFIG_PATH + '.test-backup';

function sendRpc(proc, msg) {
  proc.stdin.write(JSON.stringify(msg) + '\n');
}

function readResponse(proc, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for response')), timeout);
    let buffer = '';
    const handler = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        clearTimeout(timer);
        proc.stdout.removeListener('data', handler);
        try {
          resolve(JSON.parse(lines[lines.length - 1]));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${lines[lines.length - 1]}`));
        }
      }
    };
    proc.stdout.on('data', handler);
  });
}

describe('MCP server protocol', () => {
  let proc;

  before(() => {
    mkdirSync(CONFIG_DIR, { recursive: true });
    if (existsSync(CONFIG_PATH)) {
      rmSync(BACKUP_PATH, { force: true });
      writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
    }
    writeFileSync(CONFIG_PATH, JSON.stringify({ token: 'test-fake-token' }));

    proc = spawn('node', [SERVER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
  });

  after(() => {
    proc.kill();
    if (existsSync(BACKUP_PATH)) {
      writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
      rmSync(BACKUP_PATH, { force: true });
    } else {
      rmSync(CONFIG_PATH, { force: true });
    }
  });

  it('responds to initialize with correct protocol version', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const res = await readResponse(proc);
    assert.equal(res.jsonrpc, '2.0');
    assert.equal(res.id, 1);
    assert.ok(res.result);
    assert.equal(res.result.protocolVersion, '2024-11-05');
  });

  it('initialize response has serverInfo with github name', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 2, method: 'initialize', params: {} });
    const res = await readResponse(proc);
    assert.ok(res.result.serverInfo);
    assert.ok(res.result.serverInfo.name.includes('github'));
  });

  it('initialize response has capabilities.tools', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 3, method: 'initialize', params: {} });
    const res = await readResponse(proc);
    assert.ok(res.result.capabilities);
    assert.ok(res.result.capabilities.tools);
  });

  it('tools/list returns non-empty array', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
    const res = await readResponse(proc);
    assert.ok(res.result);
    assert.ok(Array.isArray(res.result.tools));
    assert.ok(res.result.tools.length > 0);
  });

  it('tools/list entries have name, description, inputSchema but no handler', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} });
    const res = await readResponse(proc);
    for (const tool of res.result.tools) {
      assert.equal(typeof tool.name, 'string');
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.inputSchema);
      assert.equal(tool.handler, undefined, `Tool ${tool.name} should not expose handler`);
    }
  });

  it('tools/call with unknown tool returns error', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nonexistent_tool' } });
    const res = await readResponse(proc);
    assert.ok(res.error);
    assert.equal(res.error.code, -32601);
  });

  it('unknown method returns error', async () => {
    sendRpc(proc, { jsonrpc: '2.0', id: 7, method: 'totally/unknown', params: {} });
    const res = await readResponse(proc);
    assert.ok(res.error);
    assert.equal(res.error.code, -32601);
  });
});
