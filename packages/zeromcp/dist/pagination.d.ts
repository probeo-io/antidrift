/**
 * Stateless cursor-based pagination for MCP list methods.
 * Cursor is a base64-encoded offset — no server state needed.
 */
export interface PaginatedResult<T> {
    items: T[];
    nextCursor?: string;
}
export declare function paginate<T>(items: T[], cursor?: string, pageSize?: number): PaginatedResult<T>;
//# sourceMappingURL=pagination.d.ts.map