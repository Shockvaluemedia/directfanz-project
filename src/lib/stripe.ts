import Stripe from 'stripe';

// Initialize Stripe with defensive checks for build time
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set in production environment');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

/** Platform fee when PLATFORM_FEE_PERCENT is not set (owner's choice, Nov 2026). */
export const DEFAULT_PLATFORM_FEE_PERCENT = 10;
const MAX_PLATFORM_FEE_PERCENT = 50;

/**
 * Read the platform fee percent from the environment. An unset, blank or
 * out-of-range value falls back to the default rather than charging a fee
 * nobody chose.
 */
export function resolvePlatformFeePercent(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PLATFORM_FEE_PERCENT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > MAX_PLATFORM_FEE_PERCENT) {
    console.warn(`Ignoring invalid PLATFORM_FEE_PERCENT; using ${DEFAULT_PLATFORM_FEE_PERCENT}%`);
    return DEFAULT_PLATFORM_FEE_PERCENT;
  }
  return value;
}

/**
 * Platform fee taken on every payment, as a fraction (0.10 = 10%).
 * Single source of truth for every checkout: memberships, drops, tickets and
 * other one-time purchases. Set PLATFORM_FEE_PERCENT to change it.
 */
export const PLATFORM_FEE_RATE = resolvePlatformFeePercent(process.env.PLATFORM_FEE_PERCENT) / 100;

/**
 * Platform fee in the smallest currency unit (cents) for an amount in cents.
 */
/**
 * The platform fee as Stripe's application_fee_percent (two decimals at most),
 * for subscriptions, where Stripe takes the fee from every invoice.
 */
export function platformFeePercentForStripe(rate: number = PLATFORM_FEE_RATE): number {
  return Math.round(rate * 10_000) / 100;
}

export function calculatePlatformFeeCents(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_RATE);
}

/**
 * Create a Stripe Connect account for an artist
 */
export async function createStripeConnectAccount(
  email: string,
  displayName: string
): Promise<string> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      business_profile: {
        name: displayName,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return account.id;
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    throw new Error('Failed to create Stripe Connect account');
  }
}

/**
 * Create an account link for Stripe Connect onboarding
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  } catch (error) {
    console.error('Error creating account link:', error);
    throw new Error('Failed to create account link');
  }
}

/**
 * Check if a Stripe Connect account is fully onboarded
 */
export async function checkAccountOnboardingStatus(accountId: string): Promise<boolean> {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.details_submitted && account.charges_enabled;
  } catch (error) {
    console.error('Error checking account status:', error);
    return false;
  }
}

/**
 * Create a login link for Stripe Connect dashboard
 */
export async function createLoginLink(accountId: string): Promise<string> {
  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return loginLink.url;
  } catch (error) {
    console.error('Error creating login link:', error);
    throw new Error('Failed to create login link');
  }
}

/**
 * Create a Stripe product for a tier
 */
export async function createStripeProduct(
  tierName: string,
  tierDescription: string,
  stripeAccountId: string
): Promise<string> {
  try {
    const product = await stripe.products.create(
      {
        name: tierName,
        description: tierDescription,
        type: 'service',
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    return product.id;
  } catch (error) {
    console.error('Error creating Stripe product:', error);
    throw new Error('Failed to create Stripe product');
  }
}

/**
 * Create a Stripe price for a product
 */
export async function createStripePrice(
  productId: string,
  amount: number,
  stripeAccountId: string
): Promise<string> {
  try {
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    return price.id;
  } catch (error) {
    console.error('Error creating Stripe price:', error);
    throw new Error('Failed to create Stripe price');
  }
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  priceId: string,
  customerId: string,
  stripeAccountId: string,
  successUrl: string,
  cancelUrl: string,
  metadata: Record<string, string>
): Promise<string> {
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        customer: customerId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        // Subscription checkouts take the fee as a percent on the subscription;
        // Stripe refuses payment_intent_data in subscription mode.
        subscription_data: {
          metadata,
          application_fee_percent: platformFeePercentForStripe(),
        },
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    return session.url!;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
}

export interface OneTimeCheckoutParams {
  /** Our purchases.id; also used as the Stripe idempotency key. */
  purchaseId: string;
  /** Shown on the Stripe Checkout page. */
  title: string;
  description?: string;
  /** Total in the smallest currency unit (cents). */
  amountCents: number;
  currency: string;
  customerId: string;
  /** The artist's Stripe Connect account; the charge is made on it. */
  stripeAccountId: string;
  successUrl: string;
  cancelUrl: string;
  /** When the checkout stops accepting payment (Stripe minimum: 30 minutes). */
  expiresAt?: Date;
  metadata: Record<string, string>;
}

/**
 * Create a one-off ("payment" mode) Checkout Session on the artist's Connect
 * account, with the platform fee taken as an application fee.
 */
export async function createOneTimeCheckoutSession(
  params: OneTimeCheckoutParams
): Promise<{ id: string; url: string }> {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    throw new Error('amountCents must be a positive integer');
  }

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: params.currency,
              unit_amount: params.amountCents,
              product_data: {
                name: params.title,
                ...(params.description ? { description: params.description } : {}),
              },
            },
            quantity: 1,
          },
        ],
        customer: params.customerId,
        client_reference_id: params.purchaseId,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        ...(params.expiresAt ? { expires_at: Math.floor(params.expiresAt.getTime() / 1000) } : {}),
        metadata: params.metadata,
        payment_intent_data: {
          application_fee_amount: calculatePlatformFeeCents(params.amountCents),
          metadata: params.metadata,
        },
      },
      {
        stripeAccount: params.stripeAccountId,
        idempotencyKey: `purchase-checkout-${params.purchaseId}`,
      }
    );

    if (!session.url) {
      throw new Error('Stripe returned a checkout session without a URL');
    }

    return { id: session.id, url: session.url };
  } catch (error) {
    console.error('Error creating one-time checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
}

/**
 * Create or retrieve a Stripe customer
 */
export async function createOrRetrieveCustomer(
  email: string,
  name: string,
  stripeAccountId: string
): Promise<string> {
  try {
    // First, try to find existing customer
    const existingCustomers = await stripe.customers.list(
      {
        email,
        limit: 1,
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0].id;
    }

    // Create new customer
    const customer = await stripe.customers.create(
      {
        email,
        name,
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    return customer.id;
  } catch (error) {
    console.error('Error creating/retrieving customer:', error);
    throw new Error('Failed to create/retrieve customer');
  }
}

/**
 * Create a customer portal session
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
  stripeAccountId: string
): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: returnUrl,
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    return session.url;
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw new Error('Failed to create customer portal session');
  }
}
