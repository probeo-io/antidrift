/**
 * Prompt scanner — discovers prompts from a directory.
 *
 * Prompt files export { description?, arguments?, render(args) }.
 */
import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const DYNAMIC_EXTS = new Set(['.js', '.mjs']);
export class PromptScanner {
    prompts = new Map();
    dirs;
    separator;
    constructor(config) {
        const sources = config.prompts
            ? (typeof config.prompts === 'string' ? [{ path: config.prompts }] : config.prompts.map(s => typeof s === 'string' ? { path: s } : s))
            : [];
        this.dirs = sources.map(s => s.path);
        this.separator = config.separator || '_';
    }
    async scan() {
        this.prompts.clear();
        for (const dir of this.dirs) {
            await this._scanDir(dir, dir).catch(() => { });
        }
    }
    async _scanDir(baseDir, currentDir) {
        let entries;
        try {
            entries = await readdir(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await this._scanDir(baseDir, fullPath);
                continue;
            }
            if (!entry.isFile())
                continue;
            const ext = extname(entry.name);
            if (!DYNAMIC_EXTS.has(ext))
                continue;
            const relPath = relative(baseDir, fullPath);
            const name = relPath.replace(/\.[^.]+$/, '').replace(/[\\/]/g, this.separator);
            await this._loadPrompt(fullPath, name);
        }
    }
    async _loadPrompt(filePath, name) {
        try {
            const url = pathToFileURL(filePath).href + `?t=${Date.now()}`;
            const mod = await import(url);
            const def = mod.default || mod;
            if (!def.render || typeof def.render !== 'function') {
                console.error(`[zeromcp] Prompt ${filePath}: missing render() function`);
                return;
            }
            // Convert input schema shorthand to MCP prompt arguments
            const promptArgs = [];
            if (def.arguments) {
                for (const [key, val] of Object.entries(def.arguments)) {
                    if (typeof val === 'string') {
                        promptArgs.push({ name: key, required: true });
                    }
                    else {
                        const v = val;
                        promptArgs.push({
                            name: key,
                            description: v.description,
                            required: v.optional ? false : true,
                        });
                    }
                }
            }
            this.prompts.set(name, {
                name,
                description: def.description,
                arguments: promptArgs.length > 0 ? promptArgs : undefined,
                render: def.render,
            });
        }
        catch (err) {
            console.error(`[zeromcp] Failed to load prompt ${filePath}: ${err.message}`);
        }
    }
}
//# sourceMappingURL=prompt-scanner.js.map