export interface ToolPermissions {
    network?: string[] | boolean;
    fs?: 'read' | 'write' | boolean;
    exec?: boolean;
}
interface SandboxedFetch {
    (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
export interface SandboxOptions {
    logging?: boolean;
    bypass?: boolean;
}
export declare function validatePermissions(name: string, permissions?: ToolPermissions): void;
export declare function createSandboxedFetch(name: string, permissions?: ToolPermissions, opts?: SandboxOptions): SandboxedFetch;
export declare function createSandboxedFs(name: string, permissions?: ToolPermissions, opts?: SandboxOptions): Record<string, (...args: unknown[]) => never> | null;
export declare function createSandboxedExec(name: string, permissions?: ToolPermissions, opts?: SandboxOptions): Record<string, (...args: unknown[]) => never> | null;
export interface SandboxContext {
    fetch: SandboxedFetch;
}
export declare function createSandbox(name: string, permissions?: ToolPermissions, opts?: SandboxOptions): SandboxContext;
export {};
//# sourceMappingURL=sandbox.d.ts.map