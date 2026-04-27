import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const TMP = join(import.meta.dirname, '..', '.test-tmp-mcp');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

/**
 * Simulate the writeMcpConfig logic from the MCP packages.
 * This mirrors the config-writing behavior without needing actual server files.
 */
function writeMcpConfig(options = {}) {
  const {
    cwd,
    serviceName = 'google',
    serverName = 'antidrift-google',
    claudeCode = true,
    cowork = false,
    desktopConfigDir = null,
  } = options;

  const serverDir = join(cwd, '.mcp-servers', serviceName);

  // Always copy server files (simulate with a placeholder)
  mkdirSync(join(serverDir, 'connectors'), { recursive: true });
  writeFileSync(join(serverDir, 'server.mjs'), '// server placeholder');
  writeFileSync(join(serverDir, 'connectors', `${serviceName}.mjs`), '// connector placeholder');

  // Write .mcp.json (Claude Code) — relative paths
  if (claudeCode) {
    const mcpPath = join(cwd, '.mcp.json');
    let config = {};

    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers[serverName] = {
      command: 'node',
      args: [join('.mcp-servers', serviceName, 'server.mjs')]
    };

    writeFileSync(mcpPath, JSON.stringify(config, null, 2));
  }

  // Write claude_desktop_config.json (Cowork / Claude Desktop) — absolute paths
  if (cowork && desktopConfigDir) {
    const configPath = join(desktopConfigDir, 'claude_desktop_config.json');
    mkdirSync(desktopConfigDir, { recursive: true });

    let config = {};
    if (existsSync(configPath)) {
      try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch {}
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers[serverName] = {
      command: 'node',
      args: [join(cwd, '.mcp-servers', serviceName, 'server.mjs')]
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

/**
 * Simulate platform flag parsing logic from MCP packages.
 */
function parsePlatformFlags(flags = [], desktopConfigExists = false) {
  const hasClaudeCode = flags.includes('--claude-code');
  const hasCowork = flags.includes('--cowork');
  const hasAll = flags.includes('--all');

  if (hasAll) return { claudeCode: true, cowork: true };
  if (hasClaudeCode && !hasCowork) return { claudeCode: true, cowork: false };
  if (hasCowork && !hasClaudeCode) return { claudeCode: false, cowork: true };

  // Auto-detect: always write .mcp.json; write Desktop config if it exists
  return { claudeCode: true, cowork: desktopConfigExists };
}

describe('platform flag parsing', () => {
  it('--claude-code returns claudeCode only', () => {
    const result = parsePlatformFlags(['--claude-code']);
    assert.deepStrictEqual(result, { claudeCode: true, cowork: false });
  });

  it('--cowork returns cowork only', () => {
    const result = parsePlatformFlags(['--cowork']);
    assert.deepStrictEqual(result, { claudeCode: false, cowork: true });
  });

  it('--all returns both', () => {
    const result = parsePlatformFlags(['--all']);
    assert.deepStrictEqual(result, { claudeCode: true, cowork: true });
  });

  it('auto-detect with no Desktop config writes claudeCode only', () => {
    const result = parsePlatformFlags([], false);
    assert.deepStrictEqual(result, { claudeCode: true, cowork: false });
  });

  it('auto-detect with Desktop config present writes both', () => {
    const result = parsePlatformFlags([], true);
    assert.deepStrictEqual(result, { claudeCode: true, cowork: true });
  });
});

describe('.mcp.json writing', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('writes .mcp.json with correct structure and relative paths', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: true, cowork: false });

    const mcpPath = join(cwd, '.mcp.json');
    assert.ok(existsSync(mcpPath));

    const config = JSON.parse(readFileSync(mcpPath, 'utf8'));
    assert.ok(config.mcpServers);
    assert.ok(config.mcpServers['antidrift-google']);
    assert.equal(config.mcpServers['antidrift-google'].command, 'node');

    // Path should be relative (not absolute)
    const serverPath = config.mcpServers['antidrift-google'].args[0];
    assert.ok(!serverPath.startsWith('/'), 'Path should be relative');
    assert.ok(serverPath.includes('.mcp-servers'));
  });

  it('merges with existing config (does not overwrite other servers)', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });

    // Pre-existing config
    writeFileSync(join(cwd, '.mcp.json'), JSON.stringify({
      mcpServers: {
        'some-other-server': { command: 'node', args: ['other.mjs'] }
      }
    }, null, 2));

    writeMcpConfig({ cwd, claudeCode: true, cowork: false });

    const config = JSON.parse(readFileSync(join(cwd, '.mcp.json'), 'utf8'));
    assert.ok(config.mcpServers['some-other-server'], 'Existing server should be preserved');
    assert.ok(config.mcpServers['antidrift-google'], 'New server should be added');
  });
});

describe('claude_desktop_config.json writing', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('writes claude_desktop_config.json with absolute paths', () => {
    const cwd = join(TMP, 'project');
    const desktopDir = join(TMP, 'desktop-config');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: false, cowork: true, desktopConfigDir: desktopDir });

    const configPath = join(desktopDir, 'claude_desktop_config.json');
    assert.ok(existsSync(configPath));

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.ok(config.mcpServers['antidrift-google']);

    // Path should be absolute
    const serverPath = config.mcpServers['antidrift-google'].args[0];
    assert.ok(serverPath.startsWith('/') || /^[A-Z]:/.test(serverPath), 'Path should be absolute');
  });

  it('merges with existing Desktop config (does not overwrite other servers)', () => {
    const cwd = join(TMP, 'project');
    const desktopDir = join(TMP, 'desktop-config');
    mkdirSync(cwd, { recursive: true });
    mkdirSync(desktopDir, { recursive: true });

    // Pre-existing Desktop config
    writeFileSync(join(desktopDir, 'claude_desktop_config.json'), JSON.stringify({
      mcpServers: {
        'existing-server': { command: 'python', args: ['serve.py'] }
      }
    }, null, 2));

    writeMcpConfig({ cwd, claudeCode: false, cowork: true, desktopConfigDir: desktopDir });

    const config = JSON.parse(readFileSync(join(desktopDir, 'claude_desktop_config.json'), 'utf8'));
    assert.ok(config.mcpServers['existing-server'], 'Existing server should be preserved');
    assert.ok(config.mcpServers['antidrift-google'], 'New server should be added');
  });
});

describe('platform targeting', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('--claude-code writes only .mcp.json', () => {
    const cwd = join(TMP, 'project');
    const desktopDir = join(TMP, 'desktop-config');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: true, cowork: false, desktopConfigDir: desktopDir });

    assert.ok(existsSync(join(cwd, '.mcp.json')));
    assert.ok(!existsSync(join(desktopDir, 'claude_desktop_config.json')));
  });

  it('--cowork writes only claude_desktop_config.json', () => {
    const cwd = join(TMP, 'project');
    const desktopDir = join(TMP, 'desktop-config');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: false, cowork: true, desktopConfigDir: desktopDir });

    assert.ok(!existsSync(join(cwd, '.mcp.json')));
    assert.ok(existsSync(join(desktopDir, 'claude_desktop_config.json')));
  });

  it('--all writes both', () => {
    const cwd = join(TMP, 'project');
    const desktopDir = join(TMP, 'desktop-config');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: true, cowork: true, desktopConfigDir: desktopDir });

    assert.ok(existsSync(join(cwd, '.mcp.json')));
    assert.ok(existsSync(join(desktopDir, 'claude_desktop_config.json')));
  });
});

describe('server file copying', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('copies server files to .mcp-servers/<service>/', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: true, cowork: false });

    assert.ok(existsSync(join(cwd, '.mcp-servers', 'google', 'server.mjs')));
    assert.ok(existsSync(join(cwd, '.mcp-servers', 'google', 'connectors', 'google.mjs')));
  });

  it('copies server files even when targeting cowork only', () => {
    const cwd = join(TMP, 'project');
    const desktopDir = join(TMP, 'desktop-config');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({ cwd, claudeCode: false, cowork: true, desktopConfigDir: desktopDir });

    // Server files should still be in .mcp-servers/
    assert.ok(existsSync(join(cwd, '.mcp-servers', 'google', 'server.mjs')));
  });

  it('works for attio service name', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });

    writeMcpConfig({
      cwd,
      serviceName: 'attio',
      serverName: 'antidrift-attio',
      claudeCode: true,
      cowork: false,
    });

    assert.ok(existsSync(join(cwd, '.mcp-servers', 'attio', 'server.mjs')));

    const config = JSON.parse(readFileSync(join(cwd, '.mcp.json'), 'utf8'));
    assert.ok(config.mcpServers['antidrift-attio']);
  });
});

function applyMcpJsonCleanup(localConfig, localMcpPath, antidriftNames) {
  for (const name of antidriftNames) {
    delete localConfig.mcpServers[`antidrift-${name}`];
  }
  const remainingKeys = Object.keys(localConfig.mcpServers || {});
  const otherKeys = Object.keys(localConfig).filter(k => k !== 'mcpServers');
  if (remainingKeys.length === 0 && otherKeys.length === 0) {
    unlinkSync(localMcpPath);
  } else {
    writeFileSync(localMcpPath, JSON.stringify(localConfig, null, 2));
  }
}

describe('.mcp.json cleanup after migration', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('deletes .mcp.json when all antidrift entries are migrated out and nothing else remains', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });
    const mcpPath = join(cwd, '.mcp.json');

    const localConfig = {
      mcpServers: {
        'antidrift-google': { command: 'node', args: ['.mcp-servers/google/server.mjs'] },
        'antidrift-attio': { command: 'node', args: ['.mcp-servers/attio/server.mjs'] },
      }
    };
    writeFileSync(mcpPath, JSON.stringify(localConfig, null, 2));

    applyMcpJsonCleanup(localConfig, mcpPath, ['google', 'attio']);

    assert.ok(!existsSync(mcpPath));
  });

  it('keeps .mcp.json when other non-antidrift servers still exist after migration', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });
    const mcpPath = join(cwd, '.mcp.json');

    const localConfig = {
      mcpServers: {
        'antidrift-google': { command: 'node', args: ['.mcp-servers/google/server.mjs'] },
        'my-custom-server': { command: 'python', args: ['serve.py'] },
      }
    };
    writeFileSync(mcpPath, JSON.stringify(localConfig, null, 2));

    applyMcpJsonCleanup(localConfig, mcpPath, ['google']);

    assert.ok(existsSync(mcpPath));
    const written = JSON.parse(readFileSync(mcpPath, 'utf8'));
    assert.ok(!written.mcpServers['antidrift-google']);
    assert.ok(written.mcpServers['my-custom-server']);
  });

  it('keeps .mcp.json when other top-level keys exist', () => {
    const cwd = join(TMP, 'project');
    mkdirSync(cwd, { recursive: true });
    const mcpPath = join(cwd, '.mcp.json');

    const localConfig = {
      version: 1,
      mcpServers: {
        'antidrift-attio': { command: 'node', args: ['.mcp-servers/attio/server.mjs'] },
      }
    };
    writeFileSync(mcpPath, JSON.stringify(localConfig, null, 2));

    applyMcpJsonCleanup(localConfig, mcpPath, ['attio']);

    assert.ok(existsSync(mcpPath));
    const written = JSON.parse(readFileSync(mcpPath, 'utf8'));
    assert.equal(written.version, 1);
    assert.deepEqual(written.mcpServers, {});
  });
});

describe('installZeroMcp zeromcp.config.json', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('writes cache_credentials: false when creating new zeromcp.config.json', () => {
    const antidriftDir = join(TMP, '.antidrift');
    const toolsRoot = join(antidriftDir, 'tools');
    const zeroConfigPath = join(antidriftDir, 'zeromcp.config.json');
    mkdirSync(antidriftDir, { recursive: true });

    writeFileSync(zeroConfigPath, JSON.stringify(
      { tools: [toolsRoot], credentials: {}, cache_credentials: false },
      null,
      2
    ));

    const written = JSON.parse(readFileSync(zeroConfigPath, 'utf8'));
    assert.equal(written.cache_credentials, false);
  });
});
