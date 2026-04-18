#!/usr/bin/env node
/**
 * MCP stdio test harness.
 * Spawns zeromcp serve, sends a sequence of JSON-RPC messages,
 * collects responses, and validates them.
 *
 * Tests tools/call for all 20 connectors with fake credentials.
 * Assertions check graceful error handling (not success) unless the
 * connector uses the fake aws CLI (which can return real responses).
 *
 * Usage:
 *   node mcp-call.mjs <zeromcp-bin> <config-path>
 *
 * Exits 0 if all assertions pass, 1 otherwise.
 */

import { spawn } from 'child_process';

const [,, ZEROMCP_BIN, CONFIG_PATH] = process.argv;

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else       { console.log(`  ✗ ${label}`); fail++; }
}

// ── Spawn zeromcp serve ───────────────────────────────────────────────────────
const server = spawn('node', [ZEROMCP_BIN, 'serve', '--config', CONFIG_PATH], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
server.stdout.on('data', d => { stdout += d.toString(); });
// Suppress server stderr (tool load messages etc.)
server.stderr.resume();

// ── Build the message sequence ────────────────────────────────────────────────
const messages = [
  // 1. Handshake
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'docker-test', version: '0.0.1' }
  }},
  // 2. Initialized notification (no response expected)
  { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
  // 3. List tools (sanity check)
  { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },

  // ── REST connectors: expect graceful auth errors ──────────────────────────
  { jsonrpc: '2.0', id: 4, method: 'tools/call', params: {
    name: 'github_list_repos', arguments: {}
  }},
  { jsonrpc: '2.0', id: 5, method: 'tools/call', params: {
    name: 'github_user', arguments: {}
  }},
  { jsonrpc: '2.0', id: 6, method: 'tools/call', params: {
    name: 'linear_list_teams', arguments: {}
  }},
  { jsonrpc: '2.0', id: 7, method: 'tools/call', params: {
    name: 'attio_list_people', arguments: {}
  }},
  // 8. Unknown tool — must return a structured error, not crash
  { jsonrpc: '2.0', id: 8, method: 'tools/call', params: {
    name: 'does_not_exist', arguments: {}
  }},

  // ── New connectors ────────────────────────────────────────────────────────
  { jsonrpc: '2.0', id: 9, method: 'tools/call', params: {
    name: 'clickup_list_workspaces', arguments: {}
  }},
  { jsonrpc: '2.0', id: 10, method: 'tools/call', params: {
    name: 'cloudflare_list_zones', arguments: {}
  }},
  { jsonrpc: '2.0', id: 11, method: 'tools/call', params: {
    name: 'vercel_list_projects', arguments: {}
  }},
  { jsonrpc: '2.0', id: 12, method: 'tools/call', params: {
    name: 'netlify_list_sites', arguments: {}
  }},
  { jsonrpc: '2.0', id: 13, method: 'tools/call', params: {
    name: 'pipedrive_list_deals', arguments: {}
  }},
  { jsonrpc: '2.0', id: 14, method: 'tools/call', params: {
    name: 'hubspot-crm_list_contacts', arguments: {}
  }},
  { jsonrpc: '2.0', id: 15, method: 'tools/call', params: {
    name: 'hubspot-marketing_list_campaigns', arguments: {}
  }},
  { jsonrpc: '2.0', id: 16, method: 'tools/call', params: {
    name: 'jira_list_projects', arguments: {}
  }},
  { jsonrpc: '2.0', id: 17, method: 'tools/call', params: {
    name: 'notion_list_databases', arguments: {}
  }},
  { jsonrpc: '2.0', id: 18, method: 'tools/call', params: {
    name: 'stripe_list_customers', arguments: {}
  }},
  // aws uses fake aws CLI so s3_list_buckets can succeed
  { jsonrpc: '2.0', id: 19, method: 'tools/call', params: {
    name: 'aws_s3_list_buckets', arguments: {}
  }},
  // aws-s3 uses real SDK — expect credentials error
  { jsonrpc: '2.0', id: 20, method: 'tools/call', params: {
    name: 'aws-s3_list_buckets', arguments: {}
  }},
  // aws-spot uses real SDK — expect credentials error
  { jsonrpc: '2.0', id: 21, method: 'tools/call', params: {
    name: 'aws-spot_list_azs', arguments: { region: 'us-east-1' }
  }},
  // Google connectors use googleapis with fake token — expect auth error
  { jsonrpc: '2.0', id: 22, method: 'tools/call', params: {
    name: 'calendar_today', arguments: {}
  }},
  { jsonrpc: '2.0', id: 23, method: 'tools/call', params: {
    name: 'drive_drive_list_files', arguments: {}
  }},
  { jsonrpc: '2.0', id: 24, method: 'tools/call', params: {
    name: 'gmail_list_labels', arguments: {}
  }},
  { jsonrpc: '2.0', id: 25, method: 'tools/call', params: {
    name: 'google_gmail_list_labels', arguments: {}
  }},
];

for (const msg of messages) {
  server.stdin.write(JSON.stringify(msg) + '\n');
}

// Give server time to process all messages (Google/AWS calls may take a few seconds)
await new Promise(r => setTimeout(r, 25000));
server.stdin.end();

await new Promise(r => setTimeout(r, 500));
server.kill();

// ── Parse responses ───────────────────────────────────────────────────────────
const responses = {};
for (const line of stdout.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) continue;
  try {
    const msg = JSON.parse(trimmed);
    if (msg.id != null) responses[msg.id] = msg;
  } catch {}
}

// ── Helper: assert a tool/call response ───────────────────────────────────────
function assertToolCall(id, label) {
  const r = responses[id];
  ok(`${label} responds`, !!r);
  ok(`${label} has result or error`, !!(r?.result || r?.error));
}

// ── Assertions ────────────────────────────────────────────────────────────────
console.log('\n── MCP initialize ──');
const init = responses[1];
ok('initialize responds with id:1', !!init);
ok('serverInfo present', !!init?.result?.serverInfo);
ok('capabilities.tools present', !!init?.result?.capabilities?.tools);

console.log('\n── tools/list via stdio ──');
const list = responses[3];
ok('tools/list responds', !!list);
ok('result.tools is array', Array.isArray(list?.result?.tools));
const toolNames = (list?.result?.tools || []).map(t => t.name);
// Check all 20 service prefixes
for (const svc of ['github', 'linear', 'attio', 'clickup', 'cloudflare', 'vercel',
    'netlify', 'pipedrive', 'jira', 'notion', 'stripe', 'aws',
    'calendar', 'drive', 'gmail', 'google']) {
  ok(`${svc} tools in list (${toolNames.filter(n => n.startsWith(svc + '_')).length} tools)`,
    toolNames.some(n => n.startsWith(svc + '_')));
}
for (const svc of ['hubspot-crm', 'hubspot-marketing', 'aws-s3', 'aws-spot']) {
  ok(`${svc} tools in list`,
    toolNames.some(n => n.startsWith(svc + '_')));
}

console.log('\n── tools/call: github_list_repos (expects 401) ──');
const ghList = responses[4];
ok('github_list_repos responds', !!ghList);
ok('response has result or error', !!(ghList?.result || ghList?.error));
const ghListContent = ghList?.result?.content?.[0]?.text || ghList?.error?.message || '';
ok('error mentions GitHub API', ghListContent.includes('GitHub API') || ghListContent.includes('401') || ghListContent.includes('fetch'));

console.log('\n── tools/call: github_user (expects 401) ──');
assertToolCall(5, 'github_user');
const ghUserContent = responses[5]?.result?.content?.[0]?.text || responses[5]?.error?.message || '';
ok('github_user error propagated', ghUserContent.length > 0);

console.log('\n── tools/call: linear_list_teams (expects auth error) ──');
assertToolCall(6, 'linear_list_teams');

console.log('\n── tools/call: attio_list_people (expects auth error) ──');
assertToolCall(7, 'attio_list_people');

console.log('\n── tools/call: unknown tool (expects error) ──');
const unknown = responses[8];
ok('unknown tool responds', !!unknown);
ok('unknown tool returns error', !!(unknown?.error || unknown?.result?.isError));

console.log('\n── tools/call: clickup_list_workspaces ──');
assertToolCall(9, 'clickup_list_workspaces');

console.log('\n── tools/call: cloudflare_list_zones ──');
assertToolCall(10, 'cloudflare_list_zones');

console.log('\n── tools/call: vercel_list_projects ──');
assertToolCall(11, 'vercel_list_projects');

console.log('\n── tools/call: netlify_list_sites ──');
assertToolCall(12, 'netlify_list_sites');

console.log('\n── tools/call: pipedrive_list_deals ──');
assertToolCall(13, 'pipedrive_list_deals');

console.log('\n── tools/call: hubspot-crm_list_contacts ──');
assertToolCall(14, 'hubspot-crm_list_contacts');

console.log('\n── tools/call: hubspot-marketing_list_campaigns ──');
assertToolCall(15, 'hubspot-marketing_list_campaigns');

console.log('\n── tools/call: jira_list_projects ──');
assertToolCall(16, 'jira_list_projects');

console.log('\n── tools/call: notion_list_databases ──');
assertToolCall(17, 'notion_list_databases');

console.log('\n── tools/call: stripe_list_customers ──');
assertToolCall(18, 'stripe_list_customers');

console.log('\n── tools/call: aws_s3_list_buckets (fake aws CLI) ──');
const awsList = responses[19];
ok('aws_s3_list_buckets responds', !!awsList);
ok('aws_s3_list_buckets has result', !!(awsList?.result || awsList?.error));
// With fake aws, this should succeed and say "No buckets found."
const awsContent = awsList?.result?.content?.[0]?.text || awsList?.error?.message || '';
ok('aws_s3_list_buckets returned content', awsContent.length > 0);

console.log('\n── tools/call: aws-s3_list_buckets (SDK, expects credentials error) ──');
assertToolCall(20, 'aws-s3_list_buckets');

console.log('\n── tools/call: aws-spot_list_azs (SDK, expects credentials error) ──');
assertToolCall(21, 'aws-spot_list_azs');

console.log('\n── tools/call: calendar_today (googleapis, expects auth error) ──');
assertToolCall(22, 'calendar_today');

console.log('\n── tools/call: drive_drive_list_files (googleapis, expects auth error) ──');
assertToolCall(23, 'drive_drive_list_files');

console.log('\n── tools/call: gmail_list_labels (googleapis, expects auth error) ──');
assertToolCall(24, 'gmail_list_labels');

console.log('\n── tools/call: google_gmail_list_labels (googleapis, expects auth error) ──');
assertToolCall(25, 'google_gmail_list_labels');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────');
console.log(`  stdio results: ${pass} passed, ${fail} failed`);
console.log('────────────────────────────────────────');
process.exit(fail > 0 ? 1 : 0);
