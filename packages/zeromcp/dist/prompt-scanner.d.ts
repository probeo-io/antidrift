/**
 * Prompt scanner — discovers prompts from a directory.
 *
 * Prompt files export { description?, arguments?, render(args) }.
 */
import type { Config } from './config.js';
import { type JsonSchema } from './schema.js';
export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}
export interface PromptDefinition {
    name: string;
    description?: string;
    arguments?: PromptArgument[];
    cachedArgumentSchema?: JsonSchema;
    render: (args: Record<string, unknown>) => Promise<unknown[]>;
}
export declare class PromptScanner {
    readonly prompts: Map<string, PromptDefinition>;
    private dirs;
    private separator;
    constructor(config: Config);
    scan(): Promise<void>;
    private _scanDir;
    private _loadPrompt;
}
//# sourceMappingURL=prompt-scanner.d.ts.map