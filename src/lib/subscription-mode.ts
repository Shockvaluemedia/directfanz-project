/**
 * Simulated subscriptions let fans exercise the full subscribe / content-access
 * flow before real Stripe billing is configured.
 *
 * Safety model:
 * - `ALLOW_SIMULATED_SUBSCRIPTIONS=true`  -> explicitly enabled anywhere.
 * - `ALLOW_SIMULATED_SUBSCRIPTIONS=false` -> explicitly disabled anywhere.
 * - unset -> **never in production** (fail closed, so missing/misconfigured
 *   production Stripe secrets can't silently grant free ACTIVE subscriptions).
 *   Outside production it auto-enables only while Stripe is not really set up
 *   (no secret key, or a placeholder one), so local/dev/preview work with no
 *   extra config.
 *
 * Once real Stripe keys are present (non-production, unset flag) this returns
 * false and the normal checkout path (and the Stripe-onboarding requirement)
 * applies.
 */
export function simulatedSubscriptionsEnabled(): boolean {
  const flag = process.env.ALLOW_SIMULATED_SUBSCRIPTIONS;
  if (flag === 'true') return true;
  if (flag === 'false') return false;

  // Fail closed in production unless explicitly opted in above.
  if (process.env.NODE_ENV === 'production') return false;

  const key = process.env.STRIPE_SECRET_KEY || '';
  return key === '' || key.includes('placeholder');
}
