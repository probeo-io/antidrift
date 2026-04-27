/**
 * Resource scanner — discovers resources from a directory.
 *
 * Static files (json, md, txt, etc.) are served as-is.
 * JS/MJS files export { description?, mimeType?, uriTemplate?, read() }.
 */
import type { Config } from './config.js';
export interface ResourceDefinition {
    uri: string;
    name: string;
    description?: string;
    mimeType: string;
    read: () => Promise<string>;
}
export interface ResourceTemplateDefinition {
    uriTemplate: string;
    name: string;
    description?: string;
    mimeType: string;
    read: (params: Record<string, string>) => Promise<string>;
}
export declare class ResourceScanner {
    readonly resources: Map<string, ResourceDefinition>;
    readonly templates: Map<string, ResourceTemplateDefinition>;
    private dirs;
    private separator;
    constructor(config: Config);
    scan(): Promise<void>;
    private _scanDir;
    private _loadDynamic;
    private _loadStatic;
}
//# sourceMappingURL=resource-scanner.d.ts.map