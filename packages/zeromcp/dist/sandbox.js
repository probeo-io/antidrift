export function validatePermissions(name, permissions) {
    if (!permissions)
        return;
    const elevated = [];
    if (permissions.fs)
        elevated.push(`fs: ${permissions.fs}`);
    if (permissions.exec)
        elevated.push('exec');
    if (elevated.length) {
        console.error(`[zeromcp] ${name} requests elevated permissions: ${elevated.join(' | ')}`);
    }
}
function resolveHostname(input) {
    const url = typeof input === 'string' ? new URL(input)
        : input instanceof URL ? input
            : new URL(input.url);
    return url.hostname;
}
function isAllowed(hostname, allowlist) {
    return allowlist.some(pattern => {
        if (pattern.startsWith('*.')) {
            return hostname.endsWith(pattern.slice(1)) || hostname === pattern.slice(2);
        }
        return hostname === pattern;
    });
}
export function createSandboxedFetch(name, permissions, opts) {
    const { logging, bypass } = opts || {};
    return async (input, init) => {
        const hostname = resolveHostname(input);
        const method = init?.method || 'GET';
        // No permissions or network not specified or true = full access
        if (!permissions || permissions.network === undefined || permissions.network === true) {
            if (logging)
                console.error(`[zeromcp] ${name} → ${method} ${hostname}`);
            return globalThis.fetch(input, init);
        }
        if (permissions.network === false) {
            if (bypass) {
                if (logging)
                    console.error(`[zeromcp] ⚠ ${name} → ${method} ${hostname} (network disabled — bypassed)`);
                return globalThis.fetch(input, init);
            }
            if (logging)
                console.error(`[zeromcp] ${name} ✗ ${method} ${hostname} (network disabled)`);
            throw new Error(`[zeromcp] ${name}: network access denied`);
        }
        if (Array.isArray(permissions.network)) {
            if (!isAllowed(hostname, permissions.network)) {
                if (bypass) {
                    if (logging)
                        console.error(`[zeromcp] ⚠ ${name} → ${method} ${hostname} (not in allowlist — bypassed)`);
                    return globalThis.fetch(input, init);
                }
                if (logging)
                    console.error(`[zeromcp] ${name} ✗ ${method} ${hostname} (not in allowlist)`);
                throw new Error(`[zeromcp] ${name}: network access denied for ${hostname} (allowed: ${permissions.network.join(', ')})`);
            }
            if (logging)
                console.error(`[zeromcp] ${name} → ${method} ${hostname}`);
        }
        return globalThis.fetch(input, init);
    };
}
export function createSandboxedFs(name, permissions, opts) {
    if (permissions?.fs)
        return null;
    const { bypass, logging } = opts || {};
    const deny = (method) => (..._args) => {
        if (bypass) {
            if (logging)
                console.error(`[zeromcp] ⚠ ${name} → fs.${method} (no permission — bypassed)`);
            return;
        }
        throw new Error(`[zeromcp] ${name}: fs.${method} denied`);
    };
    return new Proxy({}, {
        get: (_, prop) => deny(String(prop)),
    });
}
export function createSandboxedExec(name, permissions, opts) {
    if (permissions?.exec)
        return null;
    const { bypass, logging } = opts || {};
    const deny = (method) => (..._args) => {
        if (bypass) {
            if (logging)
                console.error(`[zeromcp] ⚠ ${name} → exec.${method} (no permission — bypassed)`);
            return;
        }
        throw new Error(`[zeromcp] ${name}: child_process.${method} denied`);
    };
    return new Proxy({}, {
        get: (_, prop) => deny(String(prop)),
    });
}
export function createSandbox(name, permissions, opts) {
    return {
        fetch: createSandboxedFetch(name, permissions, opts),
    };
}
//# sourceMappingURL=sandbox.js.map