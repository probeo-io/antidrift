import { createClient } from './client.mjs';

export default {
  description: 'Cancel a subscription.',
  input: {
    subscriptionId: { type: 'string', description: 'Subscription ID' },
    atPeriodEnd: { type: 'boolean', description: 'Cancel at end of current period (default true)', optional: true }
  },
  execute: async ({ subscriptionId, atPeriodEnd = true }, ctx) => {
    const { stripe } = createClient(ctx.credentials);
    let subscription;
    if (atPeriodEnd) {
      subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    } else {
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    }
    return { id: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end };
  }
};
