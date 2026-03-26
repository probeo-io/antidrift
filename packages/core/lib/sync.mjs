/**
 * Brain file sync — keeps CLAUDE.md, AGENTS.md, and GEMINI.md in sync.
 *
 * Priority order: CLAUDE.md > AGENTS.md > GEMINI.md
 * Whichever exists first is the source of truth.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.venv']);

/**
 * Recursively sync brain files in a directory tree.
 *
 * @param {string} rootDir - Root directory to walk
 * @returns {{ synced: number }} Number of files written/overwritten
 */
export function syncBrainFiles(rootDir) {
  let synced = 0;

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch { continue; }
    }

    const claudePath = join(dir, 'CLAUDE.md');
    const agentsPath = join(dir, 'AGENTS.md');
    const geminiPath = join(dir, 'GEMINI.md');

    // Find source of truth: CLAUDE.md > AGENTS.md > GEMINI.md
    let source = null;
    if (existsSync(claudePath)) source = claudePath;
    else if (existsSync(agentsPath)) source = agentsPath;
    else if (existsSync(geminiPath)) source = geminiPath;

    if (source) {
      const content = readFileSync(source, 'utf8');
      const targets = [claudePath, agentsPath, geminiPath];
      for (const target of targets) {
        if (target === source) continue;
        if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
          writeFileSync(target, content);
          synced++;
        }
      }
    }
  }

  walk(rootDir);
  return { synced };
}
