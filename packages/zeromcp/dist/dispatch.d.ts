/**
 * Unified JSON-RPC dispatcher for ZeroMCP.
 * Handles tools, resources, prompts, and protocol passthrough methods.
 */
import type { ToolDefinition } from './scanner.js';
import type { ResourceDefinition, ResourceTemplateDefinition } from './resource-scanner.js';
import type { PromptDefinition } from './prompt-scanner.js';
export interface JsonRpcRequest {
    jsonrpc: string;
    id?: number | string;
    method: string;
    params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    jsonrpc: string;
    id?: number | string;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
export interface ServerState {
    tools: Map<string, ToolDefinition>;
    resources: Map<string, ResourceDefinition>;
    templates: Map<string, ResourceTemplateDefinition>;
    prompts: Map<string, PromptDefinition>;
    subscriptions: Set<string>;
    executeTimeout: number;
    pageSize: number;
    version: string;
    logLevel: string;
    roots: Array<{
        uri: string;
        name?: string;
    }>;
    clientCapabilities: Record<string, unknown>;
    icon?: string;
    notify?: (method: string, params?: unknown) => void;
}
export declare function createState(overrides: Partial<ServerState> & Pick<ServerState, 'tools' | 'executeTimeout' | 'version'>): ServerState;
export declare function handleRequest(request: JsonRpcRequest, state: ServerState): Promise<JsonRpcResponse | null>;
//# sourceMappingURL=dispatch.d.ts.map