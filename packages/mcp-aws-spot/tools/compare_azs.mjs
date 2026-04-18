import { createClient, DescribeSpotPriceHistoryCommand, fmt$ } from './client.mjs';

export default {
  description: 'Compare spot prices for a specific instance type across all availability zones in a region.',
  input: {
    region: { type: 'string', description: 'AWS region (e.g. us-east-1)' },
    instance_type: { type: 'string', description: 'Instance type (e.g. m5.xlarge)' },
    product: { type: 'string', description: 'OS filter (default Linux/UNIX)', optional: true }
  },
  execute: async ({ region, instance_type, product = 'Linux/UNIX' }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
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
};
