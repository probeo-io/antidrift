import { resolveAuth } from './config.js';
import { toJsonSchema } from './schema.js';
export class RemoteManager {
    connections = new Map();
    async connect(servers) {
        const allTools = new Map();
        for (const server of servers) {
            try {
                const tools = await this.connectOne(server);
                // Namespace: servername.toolname
                for (const [toolName, tool] of tools) {
                    const namespacedName = `${server.name}.${toolName}`;
                    allTools.set(namespacedName, tool);
                    console.error(`[mcp] Remote tool: ${namespacedName}`);
                }
            }
            catch (err) {
                console.error(`[mcp] Failed to connect to ${server.name}: ${err.message}`);
            }
        }
        return allTools;
    }
    async connectOne(server) {
        if (!server.url.startsWith('http://') && !server.url.startsWith('https://')) {
            throw new Error(`Remote server "${server.name}" must have an HTTP/HTTPS URL, got: ${server.url}`);
        }
        return this.connectHttp(server);
    }
    async connectHttp(server) {
        const tools = new Map();
        const auth = resolveAuth(server.auth);
        // Initialize
        const initRes = await this.httpRpc(server.url, {
            jsonrpc: '2.0', id: 1, method: 'initialize', params: {}
        }, auth);
        // List tools
        const listRes = await this.httpRpc(server.url, {
            jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
        }, auth);
        const remoteTools = listRes?.result?.tools || [];
        for (const rt of remoteTools) {
            const input = this.schemaToInput(rt.inputSchema);
            tools.set(rt.name, {
                description: rt.description,
                input,
                cachedSchema: toJsonSchema(input),
                execute: async (args) => {
                    const callRes = await this.httpRpc(server.url, {
                        jsonrpc: '2.0', id: Date.now(),
                        method: 'tools/call',
                        params: { name: rt.name, arguments: args }
                    }, auth);
                    const content = callRes?.result?.content;
                    if (content?.[0]?.text)
                        return content[0].text;
                    return callRes?.result;
                }
            });
        }
        console.error(`[mcp] Connected to ${server.name} (HTTP): ${tools.size} tool(s)`);
        return tools;
    }
    async httpRpc(url, body, auth) {
        const headers = { 'Content-Type': 'application/json' };
        if (auth)
            headers['Authorization'] = `Bearer ${auth}`;
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
    schemaToInput(schema) {
        const input = {};
        if (!schema?.properties)
            return input;
        for (const [key, prop] of Object.entries(schema.properties)) {
            const p = prop;
            const isRequired = schema.required?.includes(key) ?? false;
            if (p.description || !isRequired) {
                input[key] = {
                    type: (p.type || 'string'),
                    ...(p.description ? { description: p.description } : {}),
                    ...(!isRequired ? { optional: true } : {})
                };
            }
            else {
                input[key] = (p.type || 'string');
            }
        }
        return input;
    }
    stop() {
        this.connections.clear();
    }
}
//# sourceMappingURL=remote.js.map