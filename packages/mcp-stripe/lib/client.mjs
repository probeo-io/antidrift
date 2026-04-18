import Stripe from 'stripe';

export function createClient(credentials) {
  const stripe = new Stripe(credentials.apiKey);
  return { stripe };
}
