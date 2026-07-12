/**
 * Simulated subscriptions let fans exercise the full subscribe / content-access
 * flow before real Stripe billing is configured.
 *
 * Enabled by default only while Stripe is not really set up (no secret key, or a
 * placeholder one). Force it on or off with ALLOW_SIMULATED_SUBSCRIPTIONS=true|false.
 * Once real Stripe keys are present, this returns false and the normal checkout
 * path (and the Stripe-onboarding requirement) applies.
 */
export function simulatedSubscriptionsEnabled(): boolean {
  const flag = process.env.ALLOW_SIMULATED_SUBSCRIPTIONS;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key === '' || key.includes('placeholder');
}
