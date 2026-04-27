export interface RemoteServer {
    name: string;
    url: string;
    auth?: string;
}
export interface NamespaceOverride {
    prefix?: string;
}
export interface CredentialSource {
    env?: string;
    file?: string;
}
export interface TransportConfig {
    type: 'stdio' | 'http';
    port?: number;
    auth?: string;
}
export interface ToolSource {
    path: string;
    prefix?: string;
}
export interface Config {
    tools?: string | (string | ToolSource)[];
    transport?: TransportConfig | TransportConfig[];
    logging?: boolean;
    bypass_permissions?: boolean;
    autoload_tools?: boolean;
    separator?: string;
    namespacing?: Record<string, NamespaceOverride>;
    credentials?: Record<string, CredentialSource>;
    cache_credentials?: boolean;
    remote?: RemoteServer[];
    execute_timeout?: number;
    page_size?: number;
    resources?: string | (string | ToolSource)[];
    prompts?: string | (string | ToolSource)[];
    icon?: string;
}
/**
 * Resolve an icon config value to a data URI.
 * Accepts: data URI (passthrough), URL (fetched), file path (read).
 */
export declare function resolveIcon(icon: string | undefined): Promise<string | undefined>;
export declare function resolveToolSources(tools?: string | (string | ToolSource)[]): ToolSource[];
export declare function resolveTransports(config: Config): TransportConfig[];
export declare function resolveCredentials(source: CredentialSource): unknown;
export declare function loadConfig(configPath: string): Promise<Config>;
export declare function resolveAuth(auth: string | undefined): string | undefined;
//# sourceMappingURL=config.d.ts.map