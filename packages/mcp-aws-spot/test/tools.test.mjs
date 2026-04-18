/**
 * Comprehensive unit tests for mcp-aws-spot tools/*.mjs (zeromcp format).
 *
 * Each tool exports { description, input, execute } where
 * execute(args, ctx) receives ctx.credentials = { accessKeyId, secretAccessKey }.
 * createClient(credentials) returns { getClient } which returns an EC2Client.
 *
 * Strategy: mock @aws-sdk/client-ec2 before importing tools so all calls
 * go through a controllable send() implementation.
 */
import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// EC2 mock — installed before any tool imports
// ---------------------------------------------------------------------------
let sendImpl = async () => ({});

const ec2ClientInstances = [];

class MockEC2Client {
  constructor(cfg) { ec2ClientInstances.push(cfg); }
  send(cmd) { return sendImpl(cmd); }
}

await mock.module('@aws-sdk/client-ec2', {
  namedExports: {
    EC2Client: MockEC2Client,
    DescribeSpotPriceHistoryCommand: class {
      constructor(p) { this.params = p; this.name = 'DescribeSpotPriceHistoryCommand'; }
    },
    DescribeAvailabilityZonesCommand: class {
      constructor(p) { this.params = p; this.name = 'DescribeAvailabilityZonesCommand'; }
    },
    DescribeInstanceTypesCommand: class {
      constructor(p) { this.params = p; this.name = 'DescribeInstanceTypesCommand'; }
    },
    GetSpotPlacementScoresCommand: class {
      constructor(p) { this.params = p; this.name = 'GetSpotPlacementScoresCommand'; }
    },
  }
});

// Base ctx
function ctx(overrides = {}) {
  return {
    credentials: {
      accessKeyId: 'AKIATEST',
      secretAccessKey: 'secret',
      ...overrides
    },
    fetch: globalThis.fetch
  };
}

// Sample spot price fixture
function makeSpotPrice(instanceType, az, price, ts) {
  return {
    InstanceType: instanceType,
    AvailabilityZone: az,
    SpotPrice: price,
    Timestamp: ts || new Date('2024-01-01T00:00:00Z')
  };
}

// ---------------------------------------------------------------------------
// Import all tools after mock installed
// ---------------------------------------------------------------------------
let toolModules;

before(async () => {
  toolModules = {
    prices:           (await import('../tools/prices.mjs')).default,
    cheapest:         (await import('../tools/cheapest.mjs')).default,
    compare_azs:      (await import('../tools/compare_azs.mjs')).default,
    compare_regions:  (await import('../tools/compare_regions.mjs')).default,
    list_azs:         (await import('../tools/list_azs.mjs')).default,
    placement_scores: (await import('../tools/placement_scores.mjs')).default,
  };
});

afterEach(() => {
  sendImpl = async () => ({});
  ec2ClientInstances.length = 0;
});

// ---------------------------------------------------------------------------
// Tool structure validation
// ---------------------------------------------------------------------------
describe('tool structure', () => {
  it('every tool exports description, input, execute', () => {
    for (const [name, tool] of Object.entries(toolModules)) {
      assert.equal(typeof tool.description, 'string', `${name}: description must be string`);
      assert.ok(tool.description.length > 0, `${name}: description must be non-empty`);
      assert.ok(tool.input !== null && typeof tool.input === 'object', `${name}: input must be object`);
      assert.equal(typeof tool.execute, 'function', `${name}: execute must be function`);
    }
  });

  it('every tool input property has type and description', () => {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    for (const [name, tool] of Object.entries(toolModules)) {
      for (const [key, prop] of Object.entries(tool.input)) {
        if (prop.type) {
          assert.ok(validTypes.includes(prop.type), `${name}.input.${key}: invalid type '${prop.type}'`);
        }
        assert.ok(typeof prop.description === 'string', `${name}.input.${key}: must have description`);
        assert.ok(prop.description.length > 0, `${name}.input.${key}: description must be non-empty`);
      }
    }
  });

  it('has 6 tool files', () => {
    assert.equal(Object.keys(toolModules).length, 6);
  });

  it('all required fields are present in input properties', () => {
    const expectations = {
      prices:           ['region'],
      cheapest:         ['region', 'min_vcpus', 'min_memory_gb'],
      compare_azs:      ['region', 'instance_type'],
      compare_regions:  ['regions', 'instance_type'],
      list_azs:         ['region'],
      placement_scores: ['instance_types'],
    };
    for (const [name, required] of Object.entries(expectations)) {
      const tool = toolModules[name];
      for (const field of required) {
        assert.ok(
          tool.input[field],
          `${name}: required field '${field}' missing from input`
        );
        assert.ok(
          tool.input[field].optional !== true,
          `${name}.input.${field}: should be marked required`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// prices
// ---------------------------------------------------------------------------
describe('prices', () => {
  it('returns sorted spot price list', async () => {
    sendImpl = async () => ({
      SpotPriceHistory: [
        makeSpotPrice('m5.xlarge', 'us-east-1a', '0.2000'),
        makeSpotPrice('m5.xlarge', 'us-east-1b', '0.1500'),
        makeSpotPrice('c5.2xlarge', 'us-east-1c', '0.1200'),
      ]
    });
    const result = await toolModules.prices.execute({ region: 'us-east-1' }, ctx());
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('us-east-1'));
    assert.ok(result.includes('m5.xlarge'));
    assert.ok(result.includes('c5.2xlarge'));
    // cheapest (0.12) should appear before most expensive (0.20) in sorted output
    const idx12 = result.indexOf('0.1200');
    const idx20 = result.indexOf('0.2000');
    assert.ok(idx12 < idx20, 'prices should be sorted ascending');
  });

  it('returns no-prices message when empty', async () => {
    sendImpl = async () => ({ SpotPriceHistory: [] });
    const result = await toolModules.prices.execute({ region: 'us-east-1' }, ctx());
    assert.ok(result.includes('No spot prices found'));
  });

  it('passes instance_types filter to command', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPriceHistory: [] }; };
    await toolModules.prices.execute(
      { region: 'us-east-1', instance_types: ['m5.xlarge', 'c5.large'] },
      ctx()
    );
    assert.deepEqual(capturedCmd.params.InstanceTypes, ['m5.xlarge', 'c5.large']);
  });

  it('does not send InstanceTypes when not provided', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPriceHistory: [] }; };
    await toolModules.prices.execute({ region: 'us-east-1' }, ctx());
    assert.equal(capturedCmd.params.InstanceTypes, undefined);
  });

  it('uses default product Linux/UNIX', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPriceHistory: [] }; };
    await toolModules.prices.execute({ region: 'us-east-1' }, ctx());
    assert.deepEqual(capturedCmd.params.ProductDescriptions, ['Linux/UNIX']);
  });

  it('respects custom product filter', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPriceHistory: [] }; };
    await toolModules.prices.execute({ region: 'us-east-1', product: 'Windows' }, ctx());
    assert.deepEqual(capturedCmd.params.ProductDescriptions, ['Windows']);
  });

  it('caps MaxResults at 1000', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPriceHistory: [] }; };
    await toolModules.prices.execute({ region: 'us-east-1', limit: 5000 }, ctx());
    assert.equal(capturedCmd.params.MaxResults, 1000);
  });

  it('formats prices with $ prefix and /hr suffix', async () => {
    sendImpl = async () => ({
      SpotPriceHistory: [makeSpotPrice('t3.micro', 'us-east-1a', '0.0052')]
    });
    const result = await toolModules.prices.execute({ region: 'us-east-1' }, ctx());
    assert.ok(result.includes('$0.0052/hr'));
  });

  it('uses the given region for EC2Client', async () => {
    sendImpl = async () => ({ SpotPriceHistory: [] });
    await toolModules.prices.execute({ region: 'eu-west-1' }, ctx());
    assert.equal(ec2ClientInstances[0].region, 'eu-west-1');
  });
});

// ---------------------------------------------------------------------------
// cheapest
// ---------------------------------------------------------------------------
describe('cheapest', () => {
  it('finds matching instance types and returns sorted prices', async () => {
    let callCount = 0;
    sendImpl = async (cmd) => {
      if (cmd.name === 'DescribeInstanceTypesCommand') {
        callCount++;
        return {
          InstanceTypes: [
            { InstanceType: 'm5.2xlarge', VCpuInfo: { DefaultVCpus: 8 }, MemoryInfo: { SizeInMiB: 32768 } },
            { InstanceType: 'c5.2xlarge', VCpuInfo: { DefaultVCpus: 8 }, MemoryInfo: { SizeInMiB: 16384 } },
          ],
          NextToken: undefined
        };
      }
      if (cmd.name === 'DescribeSpotPriceHistoryCommand') {
        return {
          SpotPriceHistory: [
            makeSpotPrice('m5.2xlarge', 'us-east-1a', '0.3000'),
            makeSpotPrice('c5.2xlarge', 'us-east-1b', '0.2500'),
          ]
        };
      }
      return {};
    };

    const result = await toolModules.cheapest.execute(
      { region: 'us-east-1', min_vcpus: 8, min_memory_gb: 16 },
      ctx()
    );
    assert.ok(result.includes('us-east-1'));
    assert.ok(result.includes('m5.2xlarge') || result.includes('c5.2xlarge'));
    // Cheaper instance should come first
    const idxC5 = result.indexOf('c5.2xlarge');
    const idxM5 = result.indexOf('m5.2xlarge');
    assert.ok(idxC5 < idxM5, 'cheaper c5 should appear before m5');
  });

  it('returns no-match message when no instance types meet requirements', async () => {
    sendImpl = async (cmd) => {
      if (cmd.name === 'DescribeInstanceTypesCommand') {
        return {
          InstanceTypes: [
            { InstanceType: 't3.micro', VCpuInfo: { DefaultVCpus: 2 }, MemoryInfo: { SizeInMiB: 1024 } }
          ]
        };
      }
      return {};
    };
    const result = await toolModules.cheapest.execute(
      { region: 'us-east-1', min_vcpus: 96, min_memory_gb: 768 },
      ctx()
    );
    assert.ok(result.includes('No instance types match'));
  });

  it('returns no-prices message when matching types have no spot prices', async () => {
    sendImpl = async (cmd) => {
      if (cmd.name === 'DescribeInstanceTypesCommand') {
        return {
          InstanceTypes: [
            { InstanceType: 'r5.4xlarge', VCpuInfo: { DefaultVCpus: 16 }, MemoryInfo: { SizeInMiB: 131072 } }
          ]
        };
      }
      if (cmd.name === 'DescribeSpotPriceHistoryCommand') {
        return { SpotPriceHistory: [] };
      }
      return {};
    };
    const result = await toolModules.cheapest.execute(
      { region: 'us-east-1', min_vcpus: 4, min_memory_gb: 32 },
      ctx()
    );
    assert.ok(result.includes('No spot prices available'));
  });

  it('filters by max_vcpus and max_memory_gb', async () => {
    let capturedTypes = [];
    sendImpl = async (cmd) => {
      if (cmd.name === 'DescribeInstanceTypesCommand') {
        return {
          InstanceTypes: [
            { InstanceType: 'm5.xlarge', VCpuInfo: { DefaultVCpus: 4 }, MemoryInfo: { SizeInMiB: 16384 } },
            { InstanceType: 'm5.4xlarge', VCpuInfo: { DefaultVCpus: 16 }, MemoryInfo: { SizeInMiB: 65536 } },
          ]
        };
      }
      if (cmd.name === 'DescribeSpotPriceHistoryCommand') {
        capturedTypes = cmd.params.InstanceTypes || [];
        return { SpotPriceHistory: [] };
      }
      return {};
    };
    await toolModules.cheapest.execute(
      { region: 'us-east-1', min_vcpus: 4, min_memory_gb: 16, max_vcpus: 4 },
      ctx()
    );
    // m5.4xlarge (16 vcpus > max 4) should be filtered out
    assert.ok(!capturedTypes.includes('m5.4xlarge'));
    assert.ok(capturedTypes.includes('m5.xlarge'));
  });

  it('deduplicates to keep lowest price per instance type', async () => {
    sendImpl = async (cmd) => {
      if (cmd.name === 'DescribeInstanceTypesCommand') {
        return {
          InstanceTypes: [
            { InstanceType: 'm5.xlarge', VCpuInfo: { DefaultVCpus: 4 }, MemoryInfo: { SizeInMiB: 16384 } }
          ]
        };
      }
      if (cmd.name === 'DescribeSpotPriceHistoryCommand') {
        return {
          SpotPriceHistory: [
            makeSpotPrice('m5.xlarge', 'us-east-1a', '0.1500'),
            makeSpotPrice('m5.xlarge', 'us-east-1b', '0.1200'),  // cheaper
            makeSpotPrice('m5.xlarge', 'us-east-1c', '0.1800'),
          ]
        };
      }
      return {};
    };
    const result = await toolModules.cheapest.execute(
      { region: 'us-east-1', min_vcpus: 4, min_memory_gb: 16 },
      ctx()
    );
    // Should show m5.xlarge only once with the cheapest (0.1200) price
    const occurrences = (result.match(/m5\.xlarge/g) || []).length;
    assert.equal(occurrences, 1);
    assert.ok(result.includes('0.1200'));
  });
});

// ---------------------------------------------------------------------------
// compare_azs
// ---------------------------------------------------------------------------
describe('compare_azs', () => {
  it('returns prices sorted by cost with cheapest labeled', async () => {
    sendImpl = async () => ({
      SpotPriceHistory: [
        makeSpotPrice('m5.xlarge', 'us-east-1a', '0.1500', new Date('2024-01-01T01:00:00Z')),
        makeSpotPrice('m5.xlarge', 'us-east-1b', '0.1200', new Date('2024-01-01T01:00:00Z')),
        makeSpotPrice('m5.xlarge', 'us-east-1c', '0.1800', new Date('2024-01-01T01:00:00Z')),
      ]
    });
    const result = await toolModules.compare_azs.execute(
      { region: 'us-east-1', instance_type: 'm5.xlarge' },
      ctx()
    );
    assert.ok(result.includes('m5.xlarge'));
    assert.ok(result.includes('us-east-1'));
    assert.ok(result.includes('(cheapest)'));
    assert.ok(result.includes('0.1200'));
    // Higher prices should show diff percentages
    assert.ok(result.includes('%'));
  });

  it('returns no-prices message when empty', async () => {
    sendImpl = async () => ({ SpotPriceHistory: [] });
    const result = await toolModules.compare_azs.execute(
      { region: 'us-east-1', instance_type: 'm5.xlarge' },
      ctx()
    );
    assert.ok(result.includes('No spot prices found'));
    assert.ok(result.includes('m5.xlarge'));
  });

  it('deduplicates by AZ keeping most recent', async () => {
    sendImpl = async () => ({
      SpotPriceHistory: [
        makeSpotPrice('c5.large', 'us-east-1a', '0.0600', new Date('2024-01-01T00:00:00Z')),
        makeSpotPrice('c5.large', 'us-east-1a', '0.0500', new Date('2024-01-01T01:00:00Z')), // more recent
      ]
    });
    const result = await toolModules.compare_azs.execute(
      { region: 'us-east-1', instance_type: 'c5.large' },
      ctx()
    );
    // Only one entry for us-east-1a, with the more recent (lower) price
    const azMatches = (result.match(/us-east-1a/g) || []).length;
    assert.equal(azMatches, 1);
    assert.ok(result.includes('0.0500'));
  });

  it('single AZ shows only (cheapest) label', async () => {
    sendImpl = async () => ({
      SpotPriceHistory: [makeSpotPrice('t3.nano', 'us-east-1a', '0.0050')]
    });
    const result = await toolModules.compare_azs.execute(
      { region: 'us-east-1', instance_type: 't3.nano' },
      ctx()
    );
    assert.ok(result.includes('(cheapest)'));
    assert.ok(!result.includes('%'));
  });
});

// ---------------------------------------------------------------------------
// compare_regions
// ---------------------------------------------------------------------------
describe('compare_regions', () => {
  it('returns prices sorted cheapest-first across regions', async () => {
    const regionPrices = {
      'us-east-1': '0.1000',
      'us-west-2': '0.1200',
      'eu-west-1': '0.0900',
    };
    sendImpl = async (cmd) => {
      const region = ec2ClientInstances[ec2ClientInstances.length - 1]?.region;
      const price = regionPrices[region] || '0.1500';
      return {
        SpotPriceHistory: [
          makeSpotPrice('m5.xlarge', `${region}a`, price)
        ]
      };
    };
    const result = await toolModules.compare_regions.execute(
      { regions: ['us-east-1', 'us-west-2', 'eu-west-1'], instance_type: 'm5.xlarge' },
      ctx()
    );
    assert.ok(result.includes('m5.xlarge'));
    assert.ok(result.includes('(cheapest)'));
    assert.ok(result.includes('%'));
  });

  it('handles regions with no prices gracefully', async () => {
    let callCount = 0;
    sendImpl = async () => {
      callCount++;
      if (callCount === 1) return { SpotPriceHistory: [makeSpotPrice('m5.xlarge', 'us-east-1a', '0.1500')] };
      return { SpotPriceHistory: [] };
    };
    const result = await toolModules.compare_regions.execute(
      { regions: ['us-east-1', 'ap-southeast-1'], instance_type: 'm5.xlarge' },
      ctx()
    );
    assert.ok(result.includes('us-east-1'));
    assert.ok(result.includes('Unavailable'));
    assert.ok(result.includes('ap-southeast-1'));
  });

  it('returns no-prices message when all regions fail', async () => {
    sendImpl = async () => ({ SpotPriceHistory: [] });
    const result = await toolModules.compare_regions.execute(
      { regions: ['us-east-1', 'eu-west-1'], instance_type: 'm5.xlarge' },
      ctx()
    );
    assert.ok(result.includes('No spot prices found'));
    assert.ok(result.includes('m5.xlarge'));
  });

  it('handles SDK errors per-region gracefully', async () => {
    let callCount = 0;
    sendImpl = async () => {
      callCount++;
      if (callCount === 1) return { SpotPriceHistory: [makeSpotPrice('t3.small', 'us-east-1a', '0.0200')] };
      throw new Error('UnauthorizedOperation');
    };
    // Should not throw globally — errors per region become unavailable entries
    const result = await toolModules.compare_regions.execute(
      { regions: ['us-east-1', 'cn-north-1'], instance_type: 't3.small' },
      ctx()
    );
    assert.ok(result.includes('us-east-1'));
  });

  it('creates a separate EC2Client per region', async () => {
    sendImpl = async () => ({
      SpotPriceHistory: [makeSpotPrice('t3.nano', 'x', '0.01')]
    });
    await toolModules.compare_regions.execute(
      { regions: ['us-east-1', 'us-west-2', 'eu-central-1'], instance_type: 't3.nano' },
      ctx()
    );
    const regions = ec2ClientInstances.map(c => c.region);
    assert.ok(regions.includes('us-east-1'));
    assert.ok(regions.includes('us-west-2'));
    assert.ok(regions.includes('eu-central-1'));
  });
});

// ---------------------------------------------------------------------------
// list_azs
// ---------------------------------------------------------------------------
describe('list_azs', () => {
  it('returns sorted AZ list with state', async () => {
    sendImpl = async () => ({
      AvailabilityZones: [
        { ZoneName: 'us-east-1c', ZoneId: 'use1-az3', State: 'available' },
        { ZoneName: 'us-east-1a', ZoneId: 'use1-az1', State: 'available' },
        { ZoneName: 'us-east-1b', ZoneId: 'use1-az2', State: 'unavailable' },
      ]
    });
    const result = await toolModules.list_azs.execute({ region: 'us-east-1' }, ctx());
    assert.ok(result.includes('us-east-1'));
    assert.ok(result.includes('us-east-1a'));
    assert.ok(result.includes('us-east-1b'));
    assert.ok(result.includes('us-east-1c'));
    assert.ok(result.includes('available'));
    // Should be sorted: 1a before 1b before 1c
    const idxA = result.indexOf('us-east-1a');
    const idxB = result.indexOf('us-east-1b');
    const idxC = result.indexOf('us-east-1c');
    assert.ok(idxA < idxB && idxB < idxC, 'AZs should be alphabetically sorted');
  });

  it('returns no-AZs message when empty', async () => {
    sendImpl = async () => ({ AvailabilityZones: [] });
    const result = await toolModules.list_azs.execute({ region: 'us-east-1' }, ctx());
    assert.ok(result.includes('No availability zones'));
  });

  it('passes zone-type filter to command', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { AvailabilityZones: [] }; };
    await toolModules.list_azs.execute({ region: 'us-east-1' }, ctx());
    const filter = capturedCmd.params.Filters?.[0];
    assert.ok(filter, 'should have filters');
    assert.equal(filter.Name, 'zone-type');
    assert.deepEqual(filter.Values, ['availability-zone']);
  });

  it('uses the given region for EC2Client', async () => {
    sendImpl = async () => ({ AvailabilityZones: [] });
    await toolModules.list_azs.execute({ region: 'ap-northeast-1' }, ctx());
    assert.equal(ec2ClientInstances[0].region, 'ap-northeast-1');
  });
});

// ---------------------------------------------------------------------------
// placement_scores
// ---------------------------------------------------------------------------
describe('placement_scores', () => {
  it('returns scores sorted highest-first', async () => {
    sendImpl = async () => ({
      SpotPlacementScores: [
        { Score: 3, Region: 'eu-west-1' },
        { Score: 9, AvailabilityZoneId: 'use1-az1' },
        { Score: 6, Region: 'us-west-2' },
      ]
    });
    const result = await toolModules.placement_scores.execute(
      { instance_types: ['m5.xlarge'] },
      ctx()
    );
    assert.ok(result.includes('m5.xlarge'));
    assert.ok(result.includes('/10'));
    // 9 should appear before 6 and 3
    const idx9 = result.indexOf(' 9/10');
    const idx6 = result.indexOf(' 6/10');
    const idx3 = result.indexOf(' 3/10');
    assert.ok(idx9 < idx6, 'score 9 should come before score 6');
    assert.ok(idx6 < idx3, 'score 6 should come before score 3');
  });

  it('returns no-scores message when empty', async () => {
    sendImpl = async () => ({ SpotPlacementScores: [] });
    const result = await toolModules.placement_scores.execute(
      { instance_types: ['m5.xlarge'] },
      ctx()
    );
    assert.ok(result.includes('No placement scores'));
  });

  it('passes instance_types and target_capacity to command', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPlacementScores: [] }; };
    await toolModules.placement_scores.execute(
      { instance_types: ['c5.xlarge', 'c5.2xlarge'], target_capacity: 5 },
      ctx()
    );
    assert.deepEqual(capturedCmd.params.InstanceTypes, ['c5.xlarge', 'c5.2xlarge']);
    assert.equal(capturedCmd.params.TargetCapacity, 5);
  });

  it('defaults target_capacity to 1', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPlacementScores: [] }; };
    await toolModules.placement_scores.execute({ instance_types: ['t3.large'] }, ctx());
    assert.equal(capturedCmd.params.TargetCapacity, 1);
  });

  it('passes RegionNames when regions provided', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPlacementScores: [] }; };
    await toolModules.placement_scores.execute(
      { instance_types: ['m5.large'], regions: ['us-east-1', 'us-west-2'] },
      ctx()
    );
    assert.deepEqual(capturedCmd.params.RegionNames, ['us-east-1', 'us-west-2']);
  });

  it('does not pass RegionNames when regions not provided', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPlacementScores: [] }; };
    await toolModules.placement_scores.execute({ instance_types: ['t3.nano'] }, ctx());
    assert.equal(capturedCmd.params.RegionNames, undefined);
  });

  it('passes SingleAvailabilityZone=true when single_az=true', async () => {
    let capturedCmd;
    sendImpl = async (cmd) => { capturedCmd = cmd; return { SpotPlacementScores: [] }; };
    await toolModules.placement_scores.execute(
      { instance_types: ['m5.xlarge'], single_az: true },
      ctx()
    );
    assert.equal(capturedCmd.params.SingleAvailabilityZone, true);
  });

  it('uses first region for EC2Client when regions provided', async () => {
    sendImpl = async () => ({ SpotPlacementScores: [] });
    await toolModules.placement_scores.execute(
      { instance_types: ['m5.xlarge'], regions: ['eu-central-1', 'us-east-1'] },
      ctx()
    );
    assert.equal(ec2ClientInstances[0].region, 'eu-central-1');
  });

  it('defaults to us-east-1 when no regions provided', async () => {
    sendImpl = async () => ({ SpotPlacementScores: [] });
    await toolModules.placement_scores.execute({ instance_types: ['t3.micro'] }, ctx());
    assert.equal(ec2ClientInstances[0].region, 'us-east-1');
  });

  it('title includes target capacity wording for plural', async () => {
    sendImpl = async () => ({
      SpotPlacementScores: [{ Score: 8, Region: 'us-east-1' }]
    });
    const result = await toolModules.placement_scores.execute(
      { instance_types: ['m5.xlarge'], target_capacity: 3 },
      ctx()
    );
    assert.ok(result.includes('3 instances'));
  });

  it('title uses singular when target_capacity=1', async () => {
    sendImpl = async () => ({
      SpotPlacementScores: [{ Score: 7, Region: 'us-east-1' }]
    });
    const result = await toolModules.placement_scores.execute(
      { instance_types: ['m5.xlarge'] },
      ctx()
    );
    assert.ok(result.includes('1 instance'));
    assert.ok(!result.includes('1 instances'));
  });
});

// ---------------------------------------------------------------------------
// fmt$ helper (tested through prices output)
// ---------------------------------------------------------------------------
describe('fmt$ price formatting', () => {
  const cases = [
    ['0.0052', '$0.0052/hr'],
    ['0.1234', '$0.1234/hr'],
    ['1.0000', '$1.0000/hr'],
    ['0.1', '$0.1000/hr'],
  ];
  for (const [input, expected] of cases) {
    it(`formats ${input} as ${expected}`, async () => {
      sendImpl = async () => ({
        SpotPriceHistory: [makeSpotPrice('t3.micro', 'us-east-1a', input)]
      });
      const result = await toolModules.prices.execute({ region: 'us-east-1' }, ctx());
      assert.ok(result.includes(expected), `Expected '${expected}' in:\n${result}`);
    });
  }
});

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------
describe('credential handling', () => {
  it('passes accessKeyId and secretAccessKey to EC2Client when provided', async () => {
    sendImpl = async () => ({ SpotPriceHistory: [] });
    await toolModules.prices.execute(
      { region: 'us-east-1' },
      ctx({ accessKeyId: 'AKIA_REAL', secretAccessKey: 'real_secret' })
    );
    const cfg = ec2ClientInstances[0];
    assert.equal(cfg.credentials.accessKeyId, 'AKIA_REAL');
    assert.equal(cfg.credentials.secretAccessKey, 'real_secret');
  });

  it('omits credentials from EC2Client when not provided', async () => {
    sendImpl = async () => ({ SpotPriceHistory: [] });
    await toolModules.prices.execute({ region: 'us-east-1' }, { credentials: {}, fetch: globalThis.fetch });
    const cfg = ec2ClientInstances[0];
    // accessKeyId is falsy — no credentials object should be set
    assert.equal(cfg.credentials, undefined);
  });
});
