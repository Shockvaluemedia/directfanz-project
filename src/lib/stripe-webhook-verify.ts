import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

/**
 * Where a Stripe webhook delivery came from.
 *
 * - `platform`: the platform account's own endpoint (STRIPE_WEBHOOK_SECRET).
 * - `connect`: a Connect endpoint that listens to events on connected
 *   accounts (STRIPE_CONNECT_WEBHOOK_SECRET). Checkout sessions, charges,
 *   invoices and subscriptions are created directly on the artist's connected
 *   account, so in production their events arrive here, each carrying the
 *   connected account id in `event.account`.
 *
 * Stripe gives each endpoint its own signing secret, so both endpoints can
 * point at the same URL and the secret that verifies a delivery tells us
 * which endpoint sent it.
 */
export type StripeWebhookSource = 'platform' | 'connect';

export interface VerifiedStripeEvent {
  event: Stripe.Event;
  source: StripeWebhookSource;
}

function configuredSecrets(): Array<{ source: StripeWebhookSource; secret: string }> {
  const secrets: Array<{ source: StripeWebhookSource; secret: string }> = [];
  const platform = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const connect = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (platform) secrets.push({ source: 'platform', secret: platform });
  if (connect && connect !== platform) secrets.push({ source: 'connect', secret: connect });
  return secrets;
}

/** True when at least one Stripe webhook signing secret is set. */
export function isStripeWebhookConfigured(): boolean {
  return configuredSecrets().length > 0;
}

/**
 * Verify a raw webhook body against every configured signing secret. Returns
 * null when no secret verifies the signature (bad signature, wrong secret or
 * an old timestamp).
 */
export function verifyStripeWebhook(
  rawBody: string,
  signature: string
): VerifiedStripeEvent | null {
  for (const { source, secret } of configuredSecrets()) {
    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      return { event, source };
    } catch {
      // Try the next endpoint's secret.
    }
  }
  return null;
}
