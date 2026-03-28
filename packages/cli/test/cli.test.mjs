import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI_PATH = join(import.meta.dirname, '..', 'bin', 'cli.mjs');

function run(args = '') {
  return execSync(`node ${CLI_PATH} ${args}`, { encoding: 'utf8', timeout: 5000 });
}

describe('CLI help', () => {
  it('shows help with no arguments', () => {
    const output = run();
    assert.ok(output.includes('antidrift'));
    assert.ok(output.includes('Usage:'));
  });

  it('shows help with --help flag', () => {
    const output = run('--help');
    assert.ok(output.includes('Usage:'));
  });

  it('shows help with help command', () => {
    const output = run('help');
    assert.ok(output.includes('Usage:'));
  });

  it('help text contains init command', () => {
    const output = run('help');
    assert.ok(output.includes('antidrift init'));
  });

  it('help text contains skills commands', () => {
    const output = run('help');
    assert.ok(output.includes('antidrift skills list'));
    assert.ok(output.includes('antidrift skills add'));
    assert.ok(output.includes('antidrift skills remove'));
  });

  it('help text contains connect commands', () => {
    const output = run('help');
    assert.ok(output.includes('antidrift connect google'));
    assert.ok(output.includes('antidrift connect stripe'));
    assert.ok(output.includes('antidrift connect github'));
    assert.ok(output.includes('antidrift connect attio'));
    assert.ok(output.includes('antidrift connect clickup'));
    assert.ok(output.includes('antidrift connect notion'));
    assert.ok(output.includes('antidrift connect gmail'));
    assert.ok(output.includes('antidrift connect drive'));
    assert.ok(output.includes('antidrift connect calendar'));
  });
});

describe('CLI version', () => {
  it('shows version with --version flag', () => {
    const output = run('--version');
    assert.ok(output.includes('antidrift'));
    assert.match(output.trim(), /antidrift \d+\.\d+\.\d+/);
  });

  it('shows version with version command', () => {
    const output = run('version');
    assert.match(output.trim(), /antidrift \d+\.\d+\.\d+/);
  });
});

describe('CLI connect list', () => {
  it('shows available services when no service specified', () => {
    const output = run('connect');
    assert.ok(output.includes('Available services'));
    assert.ok(output.includes('google'));
    assert.ok(output.includes('gmail'));
    assert.ok(output.includes('drive'));
    assert.ok(output.includes('calendar'));
    assert.ok(output.includes('stripe'));
    assert.ok(output.includes('github'));
    assert.ok(output.includes('attio'));
    assert.ok(output.includes('clickup'));
    assert.ok(output.includes('notion'));
  });
});
