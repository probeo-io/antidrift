import type { InputSchema } from './schema.js';
import type { Config } from './config.js';
import { type SandboxContext } from './sandbox.js';
export interface ToolContext {
    credentials?: unknown;
    fetch: SandboxContext['fetch'];
}
export interface ToolDefinition {
    description: string;
    input: InputSchema;
    execute: (args: Record<string, unknown>, ctx?: ToolContext) => Promise<unknown>;
}
export declare class ToolScanner {
    tools: Map<string, ToolDefinition>;
    private sources;
    private watchers;
    private separator;
    private namespacing;
    private credentialSources;
    private credentialCache;
    private logging;
    private bypass;
    constructor(config?: Config);
    scan(): Promise<Map<string, ToolDefinition>>;
    private _scanDir;
    private _buildName;
    private _getCredentials;
    private _loadTool;
    watch(onChange?: (tools: Map<string, ToolDefinition>) => void): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=scanner.d.ts.map