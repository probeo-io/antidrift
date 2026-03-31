import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'netlify.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

let tools;
let toolMap;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ token: 'test-fake-token' }));

  const mod = await import('../connectors/netlify.mjs');
  tools = mod.tools;
  toolMap = Object.fromEntries(tools.map(t => [t.name, t]));
});

after(() => {
  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

afterEach(() => {
  mock.restoreAll();
});

function getTool(name) {
  return toolMap[name];
}

function mockFetch(status, body) {
  mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

// ---------------------------------------------------------------------------
// netlify_list_sites
// ---------------------------------------------------------------------------
describe('netlify_list_sites handler', () => {
  it('returns formatted site list', async () => {
    mockFetch(200, [
      { name: 'my-site', ssl_url: 'https://my-site.netlify.app', published_deploy: { branch: 'main' }, id: 's1' },
    ]);
    const result = await getTool('netlify_list_sites').handler({});
    assert.ok(result.includes('my-site'));
    assert.ok(result.includes('https://my-site.netlify.app'));
    assert.ok(result.includes('[main]'));
    assert.ok(result.includes('[id: s1]'));
  });

  it('returns message when no sites', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_sites').handler({});
    assert.equal(result, 'No sites found.');
  });

  it('sends Bearer token header', async () => {
    mockFetch(200, []);
    await getTool('netlify_list_sites').handler({});
    const [, opts] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(opts.headers['Authorization'], 'Bearer test-fake-token');
  });
});

// ---------------------------------------------------------------------------
// netlify_get_site
// ---------------------------------------------------------------------------
describe('netlify_get_site handler', () => {
  it('returns formatted site details', async () => {
    mockFetch(200, {
      name: 'my-site', ssl_url: 'https://my-site.netlify.app', id: 's1',
      repo: { repo_path: 'myorg/my-site', branch: 'main' },
      build_settings: { cmd: 'npm run build', dir: 'dist' },
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
    });
    const result = await getTool('netlify_get_site').handler({ siteId: 's1' });
    assert.ok(result.includes('my-site'));
    assert.ok(result.includes('https://my-site.netlify.app'));
    assert.ok(result.includes('myorg/my-site'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('npm run build'));
    assert.ok(result.includes('dist'));
    assert.ok(result.includes('[id: s1]'));
  });
});

// ---------------------------------------------------------------------------
// netlify_list_deploys
// ---------------------------------------------------------------------------
describe('netlify_list_deploys handler', () => {
  it('returns formatted deploy list', async () => {
    mockFetch(200, [
      { id: 'abcdefgh12345678', state: 'ready', branch: 'main', title: 'Update homepage', deploy_time: 42, created_at: '2026-03-01T00:00:00Z' },
    ]);
    const result = await getTool('netlify_list_deploys').handler({ siteId: 's1' });
    assert.ok(result.includes('abcdefgh'));
    assert.ok(result.includes('[ready]'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('Update homepage'));
    assert.ok(result.includes('42s'));
  });

  it('returns message when no deploys', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_deploys').handler({ siteId: 's1' });
    assert.equal(result, 'No deploys found.');
  });
});

// ---------------------------------------------------------------------------
// netlify_get_deploy
// ---------------------------------------------------------------------------
describe('netlify_get_deploy handler', () => {
  it('returns formatted deploy details', async () => {
    mockFetch(200, {
      id: 'd123', state: 'ready', ssl_url: 'https://abc.netlify.app',
      branch: 'main', title: 'Fix bug', commit_ref: 'abc12345deadbeef',
      deploy_time: 30, created_at: '2026-03-01T00:00:00Z',
    });
    const result = await getTool('netlify_get_deploy').handler({ deployId: 'd123' });
    assert.ok(result.includes('d123'));
    assert.ok(result.includes('[ready]'));
    assert.ok(result.includes('https://abc.netlify.app'));
    assert.ok(result.includes('main'));
    assert.ok(result.includes('Fix bug'));
    assert.ok(result.includes('abc12345'));
    assert.ok(result.includes('30s'));
  });
});

// ---------------------------------------------------------------------------
// netlify_rollback
// ---------------------------------------------------------------------------
describe('netlify_rollback handler', () => {
  it('rolls back and returns confirmation', async () => {
    mockFetch(200, { state: 'ready' });
    const result = await getTool('netlify_rollback').handler({ siteId: 's1', deployId: 'd100' });
    assert.ok(result.includes('Rolled back'));
    assert.ok(result.includes('d100'));
    assert.ok(result.includes('[ready]'));
  });
});

// ---------------------------------------------------------------------------
// netlify_list_env_vars
// ---------------------------------------------------------------------------
describe('netlify_list_env_vars handler', () => {
  it('returns formatted env var list', async () => {
    mockFetch(200, [
      { key: 'API_KEY', values: [{ context: 'production' }, { context: 'deploy-preview' }] },
    ]);
    const result = await getTool('netlify_list_env_vars').handler({ accountId: 'team1' });
    assert.ok(result.includes('API_KEY'));
    assert.ok(result.includes('production'));
  });

  it('returns message when no env vars', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_env_vars').handler({ accountId: 'team1' });
    assert.equal(result, 'No environment variables found.');
  });
});

// ---------------------------------------------------------------------------
// netlify_set_env_var
// ---------------------------------------------------------------------------
describe('netlify_set_env_var handler', () => {
  it('sets env var and returns confirmation', async () => {
    let capturedBody;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true, status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });
    const result = await getTool('netlify_set_env_var').handler({
      accountId: 'team1', key: 'SECRET', value: 'val123'
    });
    assert.ok(result.includes('SECRET'));
    assert.ok(result.includes('all'));
    assert.equal(capturedBody[0].key, 'SECRET');
    assert.equal(capturedBody[0].values[0].value, 'val123');
  });
});

// ---------------------------------------------------------------------------
// netlify_list_forms
// ---------------------------------------------------------------------------
describe('netlify_list_forms handler', () => {
  it('returns formatted form list', async () => {
    mockFetch(200, [
      { name: 'contact', submission_count: 42, id: 'f1' },
    ]);
    const result = await getTool('netlify_list_forms').handler({ siteId: 's1' });
    assert.ok(result.includes('contact'));
    assert.ok(result.includes('42 submissions'));
    assert.ok(result.includes('[id: f1]'));
  });

  it('returns message when no forms', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_forms').handler({ siteId: 's1' });
    assert.equal(result, 'No forms found.');
  });
});

// ---------------------------------------------------------------------------
// netlify_list_submissions
// ---------------------------------------------------------------------------
describe('netlify_list_submissions handler', () => {
  it('returns formatted submissions', async () => {
    mockFetch(200, [
      { data: { name: 'Alice', email: 'alice@test.com' }, created_at: '2026-03-01T00:00:00Z' },
    ]);
    const result = await getTool('netlify_list_submissions').handler({ formId: 'f1' });
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('alice@test.com'));
  });

  it('returns message when no submissions', async () => {
    mockFetch(200, []);
    const result = await getTool('netlify_list_submissions').handler({ formId: 'f1' });
    assert.equal(result, 'No submissions found.');
  });
});

// ---------------------------------------------------------------------------
// netlify_trigger_build
// ---------------------------------------------------------------------------
describe('netlify_trigger_build handler', () => {
  it('triggers build and returns confirmation', async () => {
    mockFetch(200, { id: 'b123', done: false });
    const result = await getTool('netlify_trigger_build').handler({ siteId: 's1' });
    assert.ok(result.includes('Build triggered'));
    assert.ok(result.includes('[id: b123]'));
    assert.ok(result.includes('building'));
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('netlify error handling', () => {
  it('throws on 404 response', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 404,
      text: async () => 'Not Found',
      json: async () => ({ message: 'Not Found' }),
    }));
    await assert.rejects(
      () => getTool('netlify_get_site').handler({ siteId: 'ghost' }),
      (err) => {
        assert.ok(err.message.includes('Netlify API 404'));
        return true;
      }
    );
  });

  it('throws on 401 unauthorized', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({ message: 'Unauthorized' }),
    }));
    await assert.rejects(
      () => getTool('netlify_list_sites').handler({}),
      (err) => {
        assert.ok(err.message.includes('Netlify API 401'));
        return true;
      }
    );
  });
});
