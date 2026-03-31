import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'aws.json');
const BACKUP_PATH = CONFIG_PATH + '.tools-test-backup';

let tools;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ region: 'us-east-1' }));

  // Mock child_process so the module loads without needing a real AWS CLI
  mock.module('child_process', {
    namedExports: {
      execSync: () => JSON.stringify({}),
      existsSync: () => true,
    },
  });

  const mod = await import('../connectors/aws.mjs');
  tools = mod.tools;

  // Restore original config
  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
});

const EXPECTED_TOOLS = [
  'aws_whoami',
  'aws_s3_list_buckets',
  'aws_s3_list_objects',
  'aws_s3_get_object',
  'aws_lambda_list_functions',
  'aws_lambda_get_function',
  'aws_lambda_invoke',
  'aws_ecs_list_clusters',
  'aws_ecs_list_services',
  'aws_ecs_describe_service',
  'aws_logs_list_groups',
  'aws_logs_tail',
  'aws_sqs_list_queues',
  'aws_sqs_get_queue_attributes',
  'aws_cost_today',
];

describe('aws tool definitions', () => {
  it('exports a non-empty tools array', () => {
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
  });

  it('has expected tool count (15)', () => {
    assert.equal(tools.length, EXPECTED_TOOLS.length,
      `Expected ${EXPECTED_TOOLS.length} tools, got ${tools.length}`);
  });

  it('has all expected tools', () => {
    const names = tools.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`);
    }
  });

  it('has no duplicate tool names', () => {
    const names = tools.map(t => t.name);
    const unique = new Set(names);
    assert.equal(names.length, unique.size,
      `Duplicate tools: ${names.filter((n, i) => names.indexOf(n) !== i)}`);
  });

  it('all tool names start with aws_ prefix', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('aws_'), `Tool ${tool.name} missing aws_ prefix`);
    }
  });

  it('every tool has a string name', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.name, 'string');
      assert.ok(tool.name.length > 0, `Tool has empty name`);
    }
  });

  it('every tool has a non-empty string description', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.description, 'string',
        `Tool ${tool.name} description is not a string`);
      assert.ok(tool.description.length > 0,
        `Tool ${tool.name} has empty description`);
    }
  });

  it('every tool has an inputSchema with type object', () => {
    for (const tool of tools) {
      assert.ok(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);
      assert.equal(tool.inputSchema.type, 'object',
        `Tool ${tool.name} inputSchema.type is not 'object'`);
    }
  });

  it('every tool has a properties object in inputSchema', () => {
    for (const tool of tools) {
      assert.ok(typeof tool.inputSchema.properties === 'object',
        `Tool ${tool.name} missing inputSchema.properties`);
    }
  });

  it('every tool has a handler function', () => {
    for (const tool of tools) {
      assert.equal(typeof tool.handler, 'function',
        `Tool ${tool.name} missing handler`);
    }
  });

  it('required fields exist in properties for each tool', () => {
    for (const tool of tools) {
      if (tool.inputSchema.required) {
        assert.ok(Array.isArray(tool.inputSchema.required),
          `Tool ${tool.name} required is not an array`);
        for (const field of tool.inputSchema.required) {
          assert.ok(tool.inputSchema.properties[field],
            `Tool ${tool.name} requires '${field}' but it is not in properties`);
        }
      }
    }
  });

  it('all property types are valid JSON Schema types', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const tool of tools) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        if (prop.type) {
          assert.ok(validTypes.includes(prop.type),
            `Tool ${tool.name}.${key} has invalid type: ${prop.type}`);
        }
      }
    }
  });

  it('all properties have descriptions', () => {
    for (const tool of tools) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        assert.ok(typeof prop.description === 'string',
          `Tool ${tool.name}.${key} missing description`);
        assert.ok(prop.description.length > 0,
          `Tool ${tool.name}.${key} has empty description`);
      }
    }
  });

  it('tools with no required params have empty or missing required array', () => {
    const noParams = ['aws_whoami', 'aws_s3_list_buckets', 'aws_lambda_list_functions',
      'aws_ecs_list_clusters', 'aws_sqs_list_queues', 'aws_cost_today'];
    for (const name of noParams) {
      const tool = tools.find(t => t.name === name);
      assert.ok(tool, `Tool ${name} not found`);
      const req = tool.inputSchema.required;
      assert.ok(!req || req.length === 0,
        `Tool ${name} should have no required params but has: ${req}`);
    }
  });

  it('tools with required params declare them correctly', () => {
    const expectations = {
      aws_s3_list_objects: ['bucket'],
      aws_s3_get_object: ['bucket', 'key'],
      aws_lambda_get_function: ['functionName'],
      aws_lambda_invoke: ['functionName'],
      aws_ecs_list_services: ['cluster'],
      aws_ecs_describe_service: ['cluster', 'service'],
      aws_logs_tail: ['logGroup'],
      aws_sqs_get_queue_attributes: ['queueUrl'],
    };
    for (const [name, expectedReq] of Object.entries(expectations)) {
      const tool = tools.find(t => t.name === name);
      assert.ok(tool, `Tool ${name} not found`);
      assert.deepEqual(tool.inputSchema.required.sort(), expectedReq.sort(),
        `Tool ${name} required mismatch`);
    }
  });
});
