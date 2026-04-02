export type SimpleType = 'string' | 'number' | 'boolean' | 'object' | 'array';
export interface ExtendedField {
    type: SimpleType;
    description?: string;
    optional?: boolean;
}
export type InputField = SimpleType | ExtendedField;
export type InputSchema = Record<string, InputField>;
export interface JsonSchema {
    type: 'object';
    properties: Record<string, {
        type: string;
        description?: string;
    }>;
    required: string[];
}
export declare function toJsonSchema(input: InputSchema): JsonSchema;
export declare function validate(input: Record<string, unknown>, schema: JsonSchema): string[];
//# sourceMappingURL=schema.d.ts.map