import { createClient, GetSpotPlacementScoresCommand } from './client.mjs';

export default {
  description: 'Get spot placement scores (1-10) indicating likelihood of fulfillment for a spot request. Higher score = more likely to be fulfilled.',
  input: {
    instance_types: { type: 'array', items: { type: 'string' }, description: 'Instance types to check (e.g. ["m5.xlarge"])' },
    target_capacity: { type: 'number', description: 'Number of instances you want to launch (default 1)', optional: true },
    regions: { type: 'array', items: { type: 'string' }, description: 'Regions to check (optional — checks all if omitted)', optional: true },
    single_az: { type: 'boolean', description: 'Require all instances in a single AZ (default false)', optional: true }
  },
  execute: async ({ instance_types, target_capacity = 1, regions, single_az = false }, ctx) => {
    const { getClient } = createClient(ctx.credentials);
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
      const bar = score >= 7 ? '🟢' : score >= 4 ? '����' : '��';
      const location = s.AvailabilityZoneId || s.Region || '?';
      lines.push(`  ${bar} ${String(score).padStart(2)}/10  ${location}`);
    }
    return lines.join('\n');
  }
};
