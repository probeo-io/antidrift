import { createClient, DescribeSpotPriceHistoryCommand, fmt$ } from './client.mjs';

export default {
  description: 'Get current spot prices for EC2 instance types. Returns prices by instance type and availability zone. Filter by instance type, region, or product description (Linux/UNIX, Windows, etc).',
  input: {
    region: { type: 'string', description: 'AWS region (e.g. us-east-1)' },
    instance_types: { type: 'array', items: { type: 'string' }, description: 'Instance types to check (e.g. ["m5.xlarge", "c5.2xlarge"])', optional: true },
    product: { type: 'string', description: 'OS filter: Linux/UNIX, Windows, SUSE Linux, Red Hat Enterprise Linux (default Linux/UNIX)', optional: true },
    limit: { type: 'number', description: 'Max results (default 50)', optional: true }
  },
  execute: async ({ region, instance_types, product = 'Linux/UNIX', limit = 50 }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
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
};
