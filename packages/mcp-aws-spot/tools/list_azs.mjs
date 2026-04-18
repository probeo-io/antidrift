import { createClient, DescribeAvailabilityZonesCommand } from './client.mjs';

export default {
  description: 'List all availability zones in a region with their state.',
  input: {
    region: { type: 'string', description: 'AWS region (e.g. us-east-1)' }
  },
  execute: async ({ region }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
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
};
