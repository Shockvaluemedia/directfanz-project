import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

/**
 * Create a Stripe Connect account for an artist
 */
export async function createStripeConnectAccount(
  email: string,
  displayName: string
): Promise<string> {
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
        subscription_data: {
          metadata,
        },
        payment_intent_data: {
          application_fee_amount: Math.round(parseFloat(metadata.amount) * 100 * 0.05), // 5% platform fee
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
