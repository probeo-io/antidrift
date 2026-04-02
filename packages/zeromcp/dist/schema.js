const TYPE_MAP = {
    string: { type: 'string' },
    number: { type: 'number' },
    boolean: { type: 'boolean' },
    object: { type: 'object' },
    array: { type: 'array' },
};
export function toJsonSchema(input) {
    if (!input || Object.keys(input).length === 0) {
        return { type: 'object', properties: {}, required: [] };
    }
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
            const mapped = TYPE_MAP[value];
            if (!mapped)
                throw new Error(`Unknown type "${value}" for field "${key}"`);
            properties[key] = { ...mapped };
            required.push(key);
        }
        else if (typeof value === 'object' && value !== null) {
            const mapped = TYPE_MAP[value.type];
            if (!mapped)
                throw new Error(`Unknown type "${value.type}" for field "${key}"`);
            properties[key] = { ...mapped };
            if (value.description)
                properties[key].description = value.description;
            if (!value.optional)
                required.push(key);
        }
    }
    return { type: 'object', properties, required };
}
export function validate(input, schema) {
    const errors = [];
    for (const key of schema.required || []) {
        if (input[key] === undefined || input[key] === null) {
            errors.push(`Missing required field: ${key}`);
        }
    }
    for (const [key, value] of Object.entries(input)) {
        const prop = schema.properties[key];
        if (!prop)
            continue;
        const actual = Array.isArray(value) ? 'array' : typeof value;
        if (actual !== prop.type) {
            errors.push(`Field "${key}" expected ${prop.type}, got ${actual}`);
        }
    }
    return errors;
}
//# sourceMappingURL=schema.js.map