import { createClient, DescribeInstanceTypesCommand, DescribeSpotPriceHistoryCommand, fmt$ } from './client.mjs';

export default {
  description: 'Find the cheapest spot instances in a region matching CPU/memory requirements. Queries instance types first, then gets spot prices for matches.',
  input: {
    region: { type: 'string', description: 'AWS region (e.g. us-east-1)' },
    min_vcpus: { type: 'number', description: 'Minimum vCPUs required' },
    min_memory_gb: { type: 'number', description: 'Minimum memory in GB' },
    max_vcpus: { type: 'number', description: 'Maximum vCPUs (optional)', optional: true },
    max_memory_gb: { type: 'number', description: 'Maximum memory in GB (optional)', optional: true },
    product: { type: 'string', description: 'OS filter (default Linux/UNIX)', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ region, min_vcpus, min_memory_gb, max_vcpus, max_memory_gb, product = 'Linux/UNIX', limit = 20 }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
    const client = getClient(region);

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
};
