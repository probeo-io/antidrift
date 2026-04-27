/**
 * ZeroMCP HTTP handler — framework-agnostic JSON-RPC handler.
 *
 * Usage:
 *   const handler = await createHandler('./tools');
 *   const handler = await createHandler({ tools: ['./tools'], resources: ['./resources'], prompts: ['./prompts'] });
 *   const response = await handler(jsonRpcRequest);
 */
import { type Config } from './config.js';
import { type JsonRpcRequest, type JsonRpcResponse } from './dispatch.js';
export type McpHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse | null>;
export declare function createHandler(toolsOrConfig?: string | Config): Promise<McpHandler>;
//# sourceMappingURL=handler.d.ts.map