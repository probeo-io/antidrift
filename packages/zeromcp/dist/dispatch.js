/**
 * Unified JSON-RPC dispatcher for ZeroMCP.
 * Handles tools, resources, prompts, and protocol passthrough methods.
 */
import { validate } from './schema.js';
import { paginate } from './pagination.js';
export function createState(overrides) {
    return {
        resources: new Map(),
        templates: new Map(),
        prompts: new Map(),
        subscriptions: new Set(),
        pageSize: 0,
        logLevel: 'info',
        roots: [],
        clientCapabilities: {},
        ...overrides,
    };
}
export async function handleRequest(request, state) {
    if (!request || typeof request !== 'object')
        return null;
    const { id, method, params } = request;
    // Notifications (no id)
    if (id === undefined) {
        handleNotification(method, params, state);
        return null;
    }
    switch (method) {
        case 'initialize':
            return handleInitialize(id, params, state);
        case 'ping':
            return { jsonrpc: '2.0', id, result: {} };
        // Tools
        case 'tools/list':
            return handleToolsList(id, params, state);
        case 'tools/call':
            return handleToolsCall(id, params, state);
        // Resources
        case 'resources/list':
            return handleResourcesList(id, params, state);
        case 'resources/read':
            return handleResourcesRead(id, params, state);
        case 'resources/subscribe':
            return handleResourcesSubscribe(id, params, state);
        case 'resources/templates/list':
            return handleResourcesTemplatesList(id, params, state);
        // Prompts
        case 'prompts/list':
            return handlePromptsList(id, params, state);
        case 'prompts/get':
            return handlePromptsGet(id, params, state);
        // Passthrough
        case 'logging/setLevel':
            return handleLoggingSetLevel(id, params, state);
        case 'completion/complete':
            return handleCompletionComplete(id, params, state);
        default:
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method not found: ${method}` },
            };
    }
}
// --- Notifications ---
function handleNotification(method, params, state) {
    switch (method) {
        case 'notifications/initialized':
            break;
        case 'notifications/roots/list_changed':
            if (params?.roots && Array.isArray(params.roots)) {
                state.roots = params.roots;
            }
            break;
    }
}
// --- Initialize ---
function handleInitialize(id, params, state) {
    if (params?.capabilities) {
        state.clientCapabilities = params.capabilities;
    }
    const capabilities = {
        tools: { listChanged: true },
    };
    if (state.resources.size > 0 || state.templates.size > 0) {
        capabilities.resources = { subscribe: true, listChanged: true };
    }
    if (state.prompts.size > 0) {
        capabilities.prompts = { listChanged: true };
    }
    capabilities.logging = {};
    return {
        jsonrpc: '2.0',
        id,
        result: {
            protocolVersion: '2024-11-05',
            capabilities,
            serverInfo: { name: 'zeromcp', version: state.version },
        },
    };
}
// --- Tools ---
function handleToolsList(id, params, state) {
    const cursor = params?.cursor;
    const list = [];
    for (const [name, tool] of state.tools) {
        const entry = { name, description: tool.description, inputSchema: tool.cachedSchema };
        if (state.icon)
            entry.icons = [{ uri: state.icon }];
        list.push(entry);
    }
    const { items, nextCursor } = paginate(list, cursor, state.pageSize);
    const result = { tools: items };
    if (nextCursor)
        result.nextCursor = nextCursor;
    return { jsonrpc: '2.0', id, result };
}
async function handleToolsCall(id, params, state) {
    const p = params;
    const name = p?.name ?? '';
    const args = p?.arguments ?? {};
    const tool = state.tools.get(name);
    if (!tool) {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
    }
    const errors = validate(args, tool.cachedSchema);
    if (errors.length > 0) {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Validation errors:\n${errors.join('\n')}` }], isError: true } };
    }
    const timeout = tool.execute_timeout ?? state.executeTimeout;
    try {
        const result = await withTimeout(tool.execute(args), timeout, name);
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
    }
    catch (err) {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } };
    }
}
// --- Resources ---
function handleResourcesList(id, params, state) {
    const cursor = params?.cursor;
    const list = [];
    for (const [, res] of state.resources) {
        const entry = { uri: res.uri, name: res.name, description: res.description, mimeType: res.mimeType };
        if (state.icon)
            entry.icons = [{ uri: state.icon }];
        list.push(entry);
    }
    const { items, nextCursor } = paginate(list, cursor, state.pageSize);
    const result = { resources: items };
    if (nextCursor)
        result.nextCursor = nextCursor;
    return { jsonrpc: '2.0', id, result };
}
async function handleResourcesRead(id, params, state) {
    const uri = params?.uri ?? '';
    // Check static resources
    for (const [, res] of state.resources) {
        if (res.uri === uri) {
            try {
                const text = await res.read();
                return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: res.mimeType, text }] } };
            }
            catch (err) {
                return { jsonrpc: '2.0', id, error: { code: -32603, message: `Error reading resource: ${err.message}` } };
            }
        }
    }
    // Check templates
    for (const [, tmpl] of state.templates) {
        const match = matchTemplate(tmpl.uriTemplate, uri);
        if (match) {
            try {
                const text = await tmpl.read(match);
                return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: tmpl.mimeType, text }] } };
            }
            catch (err) {
                return { jsonrpc: '2.0', id, error: { code: -32603, message: `Error reading resource: ${err.message}` } };
            }
        }
    }
    return { jsonrpc: '2.0', id, error: { code: -32002, message: `Resource not found: ${uri}` } };
}
function handleResourcesSubscribe(id, params, state) {
    const uri = params?.uri;
    if (uri)
        state.subscriptions.add(uri);
    return { jsonrpc: '2.0', id, result: {} };
}
function handleResourcesTemplatesList(id, params, state) {
    const cursor = params?.cursor;
    const list = [];
    for (const [, tmpl] of state.templates) {
        const entry = { uriTemplate: tmpl.uriTemplate, name: tmpl.name, description: tmpl.description, mimeType: tmpl.mimeType };
        if (state.icon)
            entry.icons = [{ uri: state.icon }];
        list.push(entry);
    }
    const { items, nextCursor } = paginate(list, cursor, state.pageSize);
    const result = { resourceTemplates: items };
    if (nextCursor)
        result.nextCursor = nextCursor;
    return { jsonrpc: '2.0', id, result };
}
// --- Prompts ---
function handlePromptsList(id, params, state) {
    const cursor = params?.cursor;
    const list = [];
    for (const [, prompt] of state.prompts) {
        const entry = { name: prompt.name };
        if (prompt.description)
            entry.description = prompt.description;
        if (prompt.arguments)
            entry.arguments = prompt.arguments;
        if (state.icon)
            entry.icons = [{ uri: state.icon }];
        list.push(entry);
    }
    const { items, nextCursor } = paginate(list, cursor, state.pageSize);
    const result = { prompts: items };
    if (nextCursor)
        result.nextCursor = nextCursor;
    return { jsonrpc: '2.0', id, result };
}
async function handlePromptsGet(id, params, state) {
    const p = params;
    const name = p?.name ?? '';
    const args = p?.arguments ?? {};
    const prompt = state.prompts.get(name);
    if (!prompt) {
        return { jsonrpc: '2.0', id, error: { code: -32002, message: `Prompt not found: ${name}` } };
    }
    try {
        const messages = await prompt.render(args);
        return { jsonrpc: '2.0', id, result: { messages } };
    }
    catch (err) {
        return { jsonrpc: '2.0', id, error: { code: -32603, message: `Error rendering prompt: ${err.message}` } };
    }
}
// --- Passthrough ---
function handleLoggingSetLevel(id, params, state) {
    const level = params?.level;
    if (level)
        state.logLevel = level;
    return { jsonrpc: '2.0', id, result: {} };
}
function handleCompletionComplete(id, params, state) {
    // TODO: look up tool/resource/prompt completions when they export a completions object
    return { jsonrpc: '2.0', id, result: { completion: { values: [] } } };
}
// --- Utilities ---
function matchTemplate(template, uri) {
    const regex = template.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)');
    const match = uri.match(new RegExp(`^${regex}$`));
    return match?.groups ? { ...match.groups } : null;
}
function withTimeout(promise, ms, toolName) {
    if (ms <= 0)
        return promise;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`));
        }, ms);
        promise.then((val) => { clearTimeout(timer); resolve(val); }, (err) => { clearTimeout(timer); reject(err); });
    });
}
//# sourceMappingURL=dispatch.js.map