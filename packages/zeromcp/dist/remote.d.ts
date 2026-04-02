import type { RemoteServer } from './config.js';
import type { ToolDefinition } from './scanner.js';
interface RemoteConnection {
    server: RemoteServer;
    tools: Map<string, ToolDefinition>;
}
export declare class RemoteManager {
    connections: Map<string, RemoteConnection>;
    connect(servers: RemoteServer[]): Promise<Map<string, ToolDefinition>>;
    private connectOne;
    private connectHttp;
    private httpRpc;
    private schemaToInput;
    stop(): void;
}
export {};
//# sourceMappingURL=remote.d.ts.map