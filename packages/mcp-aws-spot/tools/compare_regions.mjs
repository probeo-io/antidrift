import { createClient, DescribeSpotPriceHistoryCommand, fmt$ } from './client.mjs';

export default {
  description: 'Compare spot prices for a specific instance type across multiple AWS regions.',
  input: {
    regions: { type: 'array', items: { type: 'string' }, description: 'Regions to compare (e.g. ["us-east-1", "us-west-2", "eu-west-1"])' },
    instance_type: { type: 'string', description: 'Instance type (e.g. m5.xlarge)' },
    product: { type: 'string', description: 'OS filter (default Linux/UNIX)', optional: true }
  },
  execute: async ({ regions, instance_type, product = 'Linux/UNIX' }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
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
};
