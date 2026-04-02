import { readdir, watch } from 'fs/promises';
import { join, basename, extname, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { resolveCredentials, resolveToolSources } from './config.js';
import { validatePermissions, createSandbox } from './sandbox.js';
export class ToolScanner {
    tools;
    sources;
    watchers;
    separator;
    namespacing;
    credentialSources;
    credentialCache;
    logging;
    bypass;
    constructor(config) {
        this.tools = new Map();
        this.sources = resolveToolSources(config?.tools);
        this.watchers = [];
        this.separator = config?.separator || '_';
        this.namespacing = config?.namespacing || {};
        this.credentialSources = config?.credentials || {};
        this.credentialCache = new Map();
        this.logging = config?.logging ?? false;
        this.bypass = config?.bypass_permissions ?? false;
    }
    async scan() {
        this.tools.clear();
        for (const source of this.sources) {
            const dir = resolve(source.path);
            await this._scanDir(dir, dir, source.prefix);
        }
        return this.tools;
    }
    async _scanDir(dir, rootDir, sourcePrefix) {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            console.error(`[zeromcp] Cannot read tools directory: ${dir}`);
            return;
        }
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                await this._scanDir(fullPath, rootDir, sourcePrefix);
                continue;
            }
            if (!entry.isFile())
                continue;
            const ext = extname(entry.name);
            if (ext !== '.js' && ext !== '.mjs')
                continue;
            await this._loadTool(fullPath, rootDir, sourcePrefix);
        }
    }
    _buildName(filePath, rootDir, sourcePrefix) {
        const rel = relative(rootDir, filePath);
        const parts = rel.split('/');
        const file = parts.pop();
        const filename = basename(file, extname(file));
        // Build the inner name (directory-based)
        let innerName = filename;
        if (parts.length > 0) {
            const dir = parts[0];
            const override = this.namespacing[dir];
            const dirPrefix = override?.prefix !== undefined ? override.prefix : dir;
            if (dirPrefix) {
                innerName = `${dirPrefix}${this.separator}${filename}`;
            }
        }
        // Apply source-level prefix
        if (sourcePrefix) {
            return `${sourcePrefix}${this.separator}${innerName}`;
        }
        return innerName;
    }
    _getCredentials(filePath, rootDir) {
        const rel = relative(rootDir, filePath);
        const parts = rel.split('/');
        if (parts.length < 2)
            return undefined;
        const dir = parts[0];
        if (this.credentialCache.has(dir))
            return this.credentialCache.get(dir);
        const source = this.credentialSources[dir];
        if (!source)
            return undefined;
        const creds = resolveCredentials(source);
        this.credentialCache.set(dir, creds);
        return creds;
    }
    async _loadTool(filePath, rootDir, sourcePrefix) {
        const fileUrl = pathToFileURL(filePath).href;
        try {
            const mod = await import(`${fileUrl}?t=${Date.now()}`);
            const tool = mod.default;
            if (!tool || !tool.execute || typeof tool.execute !== 'function') {
                return;
            }
            const name = this._buildName(filePath, rootDir, sourcePrefix);
            validatePermissions(name, tool.permissions);
            const credentials = this._getCredentials(filePath, rootDir);
            const sandboxOpts = {
                logging: this.logging,
                bypass: this.bypass,
            };
            const sandbox = createSandbox(name, tool.permissions, sandboxOpts);
            const ctx = { credentials, fetch: sandbox.fetch };
            const rawExecute = tool.execute;
            this.tools.set(name, {
                description: tool.description || '',
                input: tool.input || {},
                execute: (args) => rawExecute(args, ctx),
            });
            console.error(`[zeromcp] Loaded: ${name}`);
        }
        catch (err) {
            const rel = relative(rootDir, filePath);
            console.error(`[zeromcp] Error loading ${rel}: ${err.message}`);
        }
    }
    async watch(onChange) {
        for (const source of this.sources) {
            const dir = resolve(source.path);
            const ac = new AbortController();
            this.watchers.push(ac);
            (async () => {
                try {
                    const watcher = watch(dir, { recursive: true, signal: ac.signal });
                    for await (const event of watcher) {
                        const ext = extname(event.filename || '');
                        if (ext !== '.js' && ext !== '.mjs')
                            continue;
                        console.error(`[zeromcp] Change detected: ${event.filename}`);
                        await this.scan();
                        if (onChange)
                            onChange(this.tools);
                    }
                }
                catch (err) {
                    if (err.name !== 'AbortError')
                        throw err;
                }
            })();
        }
    }
    stop() {
        for (const ac of this.watchers)
            ac.abort();
    }
}
//# sourceMappingURL=scanner.js.map