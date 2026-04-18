import { createClient } from './client.mjs';

export default {
  description: "Get today's estimated AWS cost (requires Cost Explorer access)",
  input: {},
  execute: async (_args, ctx) => {
    const { awsCli } = createClient(ctx.credentials);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmt = d => d.toISOString().slice(0, 10);

    const data = awsCli(`ce get-cost-and-usage --time-period Start=${fmt(today)},End=${fmt(tomorrow)} --granularity DAILY --metrics UnblendedCost`);
    const results = data.ResultsByTime || [];
    if (!results.length) return 'No cost data available for today.';

    const cost = results[0].Total?.UnblendedCost;
    if (!cost) return 'No cost data available for today.';

    const amount = parseFloat(cost.Amount || 0).toFixed(2);
    const unit = cost.Unit || 'USD';
    return `Today's estimated cost: $${amount} ${unit}`;
  }
};
