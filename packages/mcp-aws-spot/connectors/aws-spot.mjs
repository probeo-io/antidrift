import { EC2Client, DescribeSpotPriceHistoryCommand, DescribeAvailabilityZonesCommand, DescribeInstanceTypesCommand, GetSpotPlacementScoresCommand } from '@aws-sdk/client-ec2';

function getClient(region) {
  return new EC2Client({ region });
}

function fmt$(price) {
  return `$${parseFloat(price).toFixed(4)}/hr`;
}

export const tools = [
  {
    name: 'spot_prices',
    description: 'Get current spot prices for EC2 instance types. Returns prices by instance type and availability zone. Filter by instance type, region, or product description (Linux/UNIX, Windows, etc).',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region (e.g. us-east-1)' },
        instance_types: { type: 'array', items: { type: 'string' }, description: 'Instance types to check (e.g. ["m5.xlarge", "c5.2xlarge"])' },
        product: { type: 'string', description: 'OS filter: Linux/UNIX, Windows, SUSE Linux, Red Hat Enterprise Linux (default Linux/UNIX)' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      },
      required: ['region']
    },
    handler: async ({ region, instance_types, product = 'Linux/UNIX', limit = 50 }) => {
      const client = getClient(region);
      const params = {
        ProductDescriptions: [product],
        MaxResults: Math.min(limit, 1000)
      };
      if (instance_types?.length) params.InstanceTypes = instance_types;

      const res = await client.send(new DescribeSpotPriceHistoryCommand(params));
      const prices = res.SpotPriceHistory || [];
      if (!prices.length) return 'No spot prices found for the given filters.';

      const sorted = prices.sort((a, b) => parseFloat(a.SpotPrice) - parseFloat(b.SpotPrice));
      const lines = [`Spot prices in ${region} (${product}):\n`];
      for (const p of sorted) {
        lines.push(`  ${fmt$(p.SpotPrice)}  ${p.InstanceType.padEnd(20)}  ${p.AvailabilityZone}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 'spot_cheapest',
    description: 'Find the cheapest spot instances in a region matching CPU/memory requirements. Queries instance types first, then gets spot prices for matches.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region (e.g. us-east-1)' },
        min_vcpus: { type: 'number', description: 'Minimum vCPUs required' },
        min_memory_gb: { type: 'number', description: 'Minimum memory in GB' },
        max_vcpus: { type: 'number', description: 'Maximum vCPUs (optional)' },
        max_memory_gb: { type: 'number', description: 'Maximum memory in GB (optional)' },
        product: { type: 'string', description: 'OS filter (default Linux/UNIX)' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['region', 'min_vcpus', 'min_memory_gb']
    },
    handler: async ({ region, min_vcpus, min_memory_gb, max_vcpus, max_memory_gb, product = 'Linux/UNIX', limit = 20 }) => {
      const client = getClient(region);

      const filters = [
        { Name: 'vcpus-info.default-vcpus', Values: [] },
        { Name: 'memory-info.size-in-mib', Values: [] }
      ];

      // Get instance types matching requirements
      const typeParams = {
        Filters: [
          { Name: 'supported-usage-class', Values: ['spot'] }
        ]
      };

      let matchingTypes = [];
      let nextToken;
      do {
        const cmd = new DescribeInstanceTypesCommand({ ...typeParams, NextToken: nextToken, MaxResults: 100 });
        const res = await client.send(cmd);
        for (const t of (res.InstanceTypes || [])) {
          const vcpus = t.VCpuInfo?.DefaultVCpus || 0;
          const memMb = t.MemoryInfo?.SizeInMiB || 0;
          const memGb = memMb / 1024;
          if (vcpus >= min_vcpus && memGb >= min_memory_gb) {
            if (max_vcpus && vcpus > max_vcpus) continue;
            if (max_memory_gb && memGb > max_memory_gb) continue;
            matchingTypes.push({ type: t.InstanceType, vcpus, memGb: Math.round(memGb * 10) / 10 });
          }
        }
        nextToken = res.NextToken;
      } while (nextToken && matchingTypes.length < 200);

      if (!matchingTypes.length) return 'No instance types match the given requirements.';

      // Get spot prices for matching types (batch in groups of 100)
      const allPrices = [];
      for (let i = 0; i < matchingTypes.length; i += 100) {
        const batch = matchingTypes.slice(i, i + 100).map(t => t.type);
        const priceRes = await client.send(new DescribeSpotPriceHistoryCommand({
          InstanceTypes: batch,
          ProductDescriptions: [product],
          MaxResults: 1000
        }));
        allPrices.push(...(priceRes.SpotPriceHistory || []));
      }

      // Dedupe — keep lowest price per instance type (best AZ)
      const best = new Map();
      for (const p of allPrices) {
        const existing = best.get(p.InstanceType);
        if (!existing || parseFloat(p.SpotPrice) < parseFloat(existing.SpotPrice)) {
          best.set(p.InstanceType, p);
        }
      }

      const typeMap = new Map(matchingTypes.map(t => [t.type, t]));
      const results = [...best.values()]
        .sort((a, b) => parseFloat(a.SpotPrice) - parseFloat(b.SpotPrice))
        .slice(0, limit);

      if (!results.length) return 'No spot prices available for matching instance types.';

      const lines = [`Cheapest spot instances in ${region} (>= ${min_vcpus} vCPUs, >= ${min_memory_gb} GB RAM):\n`];
      for (const p of results) {
        const info = typeMap.get(p.InstanceType);
        const specs = info ? `${info.vcpus} vCPUs, ${info.memGb} GB` : '';
        lines.push(`  ${fmt$(p.SpotPrice)}  ${p.InstanceType.padEnd(20)}  ${p.AvailabilityZone.padEnd(14)}  ${specs}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 'spot_compare_azs',
    description: 'Compare spot prices for a specific instance type across all availability zones in a region.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region (e.g. us-east-1)' },
        instance_type: { type: 'string', description: 'Instance type (e.g. m5.xlarge)' },
        product: { type: 'string', description: 'OS filter (default Linux/UNIX)' }
      },
      required: ['region', 'instance_type']
    },
    handler: async ({ region, instance_type, product = 'Linux/UNIX' }) => {
      const client = getClient(region);
      const res = await client.send(new DescribeSpotPriceHistoryCommand({
        InstanceTypes: [instance_type],
        ProductDescriptions: [product],
        MaxResults: 100
      }));

      const prices = res.SpotPriceHistory || [];
      if (!prices.length) return `No spot prices found for ${instance_type} in ${region}.`;

      // Dedupe by AZ — keep most recent
      const byAz = new Map();
      for (const p of prices) {
        const existing = byAz.get(p.AvailabilityZone);
        if (!existing || new Date(p.Timestamp) > new Date(existing.Timestamp)) {
          byAz.set(p.AvailabilityZone, p);
        }
      }

      const sorted = [...byAz.values()].sort((a, b) => parseFloat(a.SpotPrice) - parseFloat(b.SpotPrice));
      const cheapest = parseFloat(sorted[0].SpotPrice);
      const lines = [`${instance_type} spot prices in ${region} (${product}):\n`];
      for (const p of sorted) {
        const price = parseFloat(p.SpotPrice);
        const diff = price > cheapest ? ` (+${((price - cheapest) / cheapest * 100).toFixed(1)}%)` : ' (cheapest)';
        lines.push(`  ${fmt$(p.SpotPrice)}  ${p.AvailabilityZone}${diff}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 'spot_compare_regions',
    description: 'Compare spot prices for a specific instance type across multiple AWS regions.',
    inputSchema: {
      type: 'object',
      properties: {
        regions: { type: 'array', items: { type: 'string' }, description: 'Regions to compare (e.g. ["us-east-1", "us-west-2", "eu-west-1"])' },
        instance_type: { type: 'string', description: 'Instance type (e.g. m5.xlarge)' },
        product: { type: 'string', description: 'OS filter (default Linux/UNIX)' }
      },
      required: ['regions', 'instance_type']
    },
    handler: async ({ regions, instance_type, product = 'Linux/UNIX' }) => {
      const results = await Promise.all(regions.map(async (region) => {
        const client = getClient(region);
        try {
          const res = await client.send(new DescribeSpotPriceHistoryCommand({
            InstanceTypes: [instance_type],
            ProductDescriptions: [product],
            MaxResults: 20
          }));
          const prices = res.SpotPriceHistory || [];
          if (!prices.length) return { region, price: null, az: null };
          const cheapest = prices.sort((a, b) => parseFloat(a.SpotPrice) - parseFloat(b.SpotPrice))[0];
          return { region, price: parseFloat(cheapest.SpotPrice), az: cheapest.AvailabilityZone };
        } catch (err) {
          return { region, price: null, az: null, error: err.message };
        }
      }));

      const valid = results.filter(r => r.price !== null).sort((a, b) => a.price - b.price);
      const failed = results.filter(r => r.price === null);

      if (!valid.length) return `No spot prices found for ${instance_type} in any of the given regions.`;

      const cheapest = valid[0].price;
      const lines = [`${instance_type} spot prices across regions (${product}):\n`];
      for (const r of valid) {
        const diff = r.price > cheapest ? ` (+${((r.price - cheapest) / cheapest * 100).toFixed(1)}%)` : ' (cheapest)';
        lines.push(`  ${fmt$(r.price)}  ${r.region.padEnd(16)}  ${r.az}${diff}`);
      }
      if (failed.length) {
        lines.push(`\n  Unavailable: ${failed.map(r => r.region).join(', ')}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 'spot_placement_scores',
    description: 'Get spot placement scores (1-10) indicating likelihood of fulfillment for a spot request. Higher score = more likely to be fulfilled.',
    inputSchema: {
      type: 'object',
      properties: {
        instance_types: { type: 'array', items: { type: 'string' }, description: 'Instance types to check (e.g. ["m5.xlarge"])' },
        target_capacity: { type: 'number', description: 'Number of instances you want to launch (default 1)' },
        regions: { type: 'array', items: { type: 'string' }, description: 'Regions to check (optional — checks all if omitted)' },
        single_az: { type: 'boolean', description: 'Require all instances in a single AZ (default false)' }
      },
      required: ['instance_types']
    },
    handler: async ({ instance_types, target_capacity = 1, regions, single_az = false }) => {
      const client = getClient(regions?.[0] || 'us-east-1');
      const params = {
        InstanceTypes: instance_types,
        TargetCapacity: target_capacity,
        TargetCapacityUnitType: 'units',
        SingleAvailabilityZone: single_az
      };
      if (regions?.length) {
        params.RegionNames = regions;
      }

      const res = await client.send(new GetSpotPlacementScoresCommand(params));
      const scores = res.SpotPlacementScores || [];
      if (!scores.length) return 'No placement scores returned.';

      const sorted = scores.sort((a, b) => (b.Score || 0) - (a.Score || 0));
      const lines = [`Spot placement scores for ${instance_types.join(', ')} (${target_capacity} instance${target_capacity > 1 ? 's' : ''}):\n`];
      for (const s of sorted) {
        const score = s.Score || 0;
        const bar = score >= 7 ? '🟢' : score >= 4 ? '🟡' : '🔴';
        const location = s.AvailabilityZoneId || s.Region || '?';
        lines.push(`  ${bar} ${String(score).padStart(2)}/10  ${location}`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 'spot_list_azs',
    description: 'List all availability zones in a region with their state.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region (e.g. us-east-1)' }
      },
      required: ['region']
    },
    handler: async ({ region }) => {
      const client = getClient(region);
      const res = await client.send(new DescribeAvailabilityZonesCommand({
        Filters: [{ Name: 'zone-type', Values: ['availability-zone'] }]
      }));
      const zones = res.AvailabilityZones || [];
      if (!zones.length) return `No availability zones found in ${region}.`;

      const lines = [`Availability zones in ${region}:\n`];
      for (const z of zones.sort((a, b) => a.ZoneName.localeCompare(b.ZoneName))) {
        const icon = z.State === 'available' ? '🟢' : '🔴';
        lines.push(`  ${icon} ${z.ZoneName}  (${z.ZoneId})  ${z.State}`);
      }
      return lines.join('\n');
    }
  }
];
