// Mock Stripe before importing
jest.mock('stripe', () => {
  const mockStripeInstance = {
    accounts: {
      create: jest.fn(),
      retrieve: jest.fn(),
      createLoginLink: jest.fn(),
    },
    accountLinks: {
      create: jest.fn(),
    },
    products: {
      create: jest.fn(),
    },
    prices: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
  };
  
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

const mockStripe = require('stripe')();

import {
  createStripeConnectAccount,
  createAccountLink,
  checkAccountOnboardingStatus,
  createStripeProduct,
  createStripePrice,
  createCheckoutSession,
  createOrRetrieveCustomer,
  createCustomerPortalSession,
} from '../stripe';

describe('Stripe Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStripeConnectAccount', () => {
    it('should create a Stripe Connect account successfully', async () => {
      const mockAccount = { id: 'acct_test123' };
      mockStripe.accounts.create.mockResolvedValue(mockAccount);

      const result = await createStripeConnectAccount('test@example.com', 'Test Artist');

      expect(mockStripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        email: 'test@example.com',
        business_profile: {
          name: 'Test Artist',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      expect(result).toBe('acct_test123');
    });

    it('should throw error when Stripe account creation fails', async () => {
      mockStripe.accounts.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        createStripeConnectAccount('test@example.com', 'Test Artist')
      ).rejects.toThrow('Failed to create Stripe Connect account');
    });
  });

  describe('createAccountLink', () => {
    it('should create an account link successfully', async () => {
      const mockLink = { url: 'https://connect.stripe.com/setup/test' };
      mockStripe.accountLinks.create.mockResolvedValue(mockLink);

      const result = await createAccountLink(
        'acct_test123',
        'http://localhost:3000/refresh',
        'http://localhost:3000/return'
      );

      expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_test123',
        refresh_url: 'http://localhost:3000/refresh',
        return_url: 'http://localhost:3000/return',
        type: 'account_onboarding',
      });
      expect(result).toBe('https://connect.stripe.com/setup/test');
    });
  });

  describe('checkAccountOnboardingStatus', () => {
    it('should return true for fully onboarded account', async () => {
      const mockAccount = {
        details_submitted: true,
        charges_enabled: true,
      };
      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      const result = await checkAccountOnboardingStatus('acct_test123');

      expect(result).toBe(true);
    });

    it('should return false for incomplete account', async () => {
      const mockAccount = {
        details_submitted: false,
        charges_enabled: false,
      };
      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      const result = await checkAccountOnboardingStatus('acct_test123');

      expect(result).toBe(false);
    });

    it('should return false when account retrieval fails', async () => {
      mockStripe.accounts.retrieve.mockRejectedValue(new Error('Account not found'));

      const result = await checkAccountOnboardingStatus('acct_test123');

      expect(result).toBe(false);
    });
  });

  describe('createStripeProduct', () => {
    it('should create a Stripe product successfully', async () => {
      const mockProduct = { id: 'prod_test123' };
      mockStripe.products.create.mockResolvedValue(mockProduct);

      const result = await createStripeProduct(
        'Premium Tier',
        'Access to premium content',
        'acct_test123'
      );

      expect(mockStripe.products.create).toHaveBeenCalledWith(
        {
          name: 'Premium Tier',
          description: 'Access to premium content',
          type: 'service',
        },
        {
          stripeAccount: 'acct_test123',
        }
      );
      expect(result).toBe('prod_test123');
    });
  });

  describe('createStripePrice', () => {
    it('should create a Stripe price successfully', async () => {
      const mockPrice = { id: 'price_test123' };
      mockStripe.prices.create.mockResolvedValue(mockPrice);

      const result = await createStripePrice('prod_test123', 10.00, 'acct_test123');

      expect(mockStripe.prices.create).toHaveBeenCalledWith(
        {
          product: 'prod_test123',
          unit_amount: 1000, // $10.00 in cents
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
        },
        {
          stripeAccount: 'acct_test123',
        }
      );
      expect(result).toBe('price_test123');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session successfully', async () => {
      const mockSession = { url: 'https://checkout.stripe.com/test' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const metadata = {
        fanId: 'fan123',
        artistId: 'artist123',
        tierId: 'tier123',
        amount: '10.00',
      };

      const result = await createCheckoutSession(
        'price_test123',
        'cus_test123',
        'acct_test123',
        'http://localhost:3000/success',
        'http://localhost:3000/cancel',
        metadata
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price: 'price_test123',
              quantity: 1,
            },
          ],
          customer: 'cus_test123',
          success_url: 'http://localhost:3000/success',
          cancel_url: 'http://localhost:3000/cancel',
          metadata,
          subscription_data: {
            metadata,
          },
          payment_intent_data: {
            application_fee_amount: 50, // 5% of $10.00
          },
        },
        {
          stripeAccount: 'acct_test123',
        }
      );
      expect(result).toBe('https://checkout.stripe.com/test');
    });
  });

  describe('createOrRetrieveCustomer', () => {
    it('should return existing customer if found', async () => {
      const mockCustomers = {
        data: [{ id: 'cus_existing123' }],
      };
      mockStripe.customers.list.mockResolvedValue(mockCustomers);

      const result = await createOrRetrieveCustomer(
        'test@example.com',
        'Test Fan',
        'acct_test123'
      );

      expect(mockStripe.customers.list).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          limit: 1,
        },
        {
          stripeAccount: 'acct_test123',
        }
      );
      expect(result).toBe('cus_existing123');
    });

    it('should create new customer if none exists', async () => {
      const mockCustomers = { data: [] };
      const mockNewCustomer = { id: 'cus_new123' };
      
      mockStripe.customers.list.mockResolvedValue(mockCustomers);
      mockStripe.customers.create.mockResolvedValue(mockNewCustomer);

      const result = await createOrRetrieveCustomer(
        'test@example.com',
        'Test Fan',
        'acct_test123'
      );

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          name: 'Test Fan',
        },
        {
          stripeAccount: 'acct_test123',
        }
      );
      expect(result).toBe('cus_new123');
    });
  });

  describe('createCustomerPortalSession', () => {
    it('should create a customer portal session successfully', async () => {
      const mockSession = { url: 'https://billing.stripe.com/test' };
      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession);

      const result = await createCustomerPortalSession(
        'cus_test123',
        'http://localhost:3000/return',
        'acct_test123'
      );

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        {
          customer: 'cus_test123',
          return_url: 'http://localhost:3000/return',
        },
        {
          stripeAccount: 'acct_test123',
        }
      );
      expect(result).toBe('https://billing.stripe.com/test');
    });
  });
});