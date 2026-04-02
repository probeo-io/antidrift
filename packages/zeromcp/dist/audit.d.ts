import type { ToolSource } from './config.js';
interface AuditViolation {
    file: string;
    line: number;
    pattern: string;
    message: string;
}
export declare function auditTools(tools: string | (string | ToolSource)[]): Promise<AuditViolation[]>;
export declare function formatAuditResults(violations: AuditViolation[]): string;
export {};
//# sourceMappingURL=audit.d.ts.map