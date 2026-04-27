/**
 * Stateless cursor-based pagination for MCP list methods.
 * Cursor is a base64-encoded offset — no server state needed.
 */
export function paginate(items, cursor, pageSize = 0) {
    // pageSize 0 = no pagination, return all
    if (!pageSize || pageSize <= 0) {
        return { items };
    }
    const offset = cursor ? decodeCursor(cursor) : 0;
    const slice = items.slice(offset, offset + pageSize);
    const hasMore = offset + pageSize < items.length;
    return {
        items: slice,
        nextCursor: hasMore ? encodeCursor(offset + pageSize) : undefined,
    };
}
function encodeCursor(offset) {
    return Buffer.from(String(offset)).toString('base64');
}
function decodeCursor(cursor) {
    try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const offset = parseInt(decoded, 10);
        return isNaN(offset) || offset < 0 ? 0 : offset;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=pagination.js.map