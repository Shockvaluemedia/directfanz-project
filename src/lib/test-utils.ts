/**
 * Test Utilities
 *
 * Comprehensive utilities for testing Direct-to-Fan Platform
 * Includes mocks for Stripe, database, authentication, and business logic
 */

import { jest } from '@jest/globals';

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'fan',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  emailVerified: true,
  ...overrides,
});

export const createMockArtist = (overrides = {}) => ({
  id: 'artist-123',
  userId: 'user-123',
  displayName: 'Test Artist',
  bio: 'Test bio',
  isVerified: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const createMockSubscription = (overrides = {}) => ({
  id: 'sub-123',
  userId: 'user-123',
  artistId: 'artist-123',
  tierId: 'tier-123',
  stripeSubscriptionId: 'stripe_sub_123',
  status: 'ACTIVE',
  currentPeriodStart: new Date('2024-01-01'),
  currentPeriodEnd: new Date('2024-02-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const createMockTier = (overrides = {}) => ({
  id: 'tier-123',
  artistId: 'artist-123',
  name: 'Basic Tier',
  description: 'Basic subscription tier',
  price: 10.0,
  currency: 'USD',
  stripePriceId: 'price_123',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const createMockContent = (overrides = {}) => ({
  id: 'content-123',
  artistId: 'artist-123',
  title: 'Test Content',
  description: 'Test content description',
  type: 'IMAGE',
  fileUrl: 'https://example.com/content.jpg',
  visibility: 'TIER_LOCKED',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  tiers: [createMockTier()],
  ...overrides,
});

export const createMockInvoice = (overrides = {}) => ({
  id: 'inv-123',
  subscriptionId: 'sub-123',
  stripeInvoiceId: 'in_stripe_123',
  amount: 10.0,
  currency: 'USD',
  status: 'paid',
  dueDate: new Date('2024-02-01'),
  paidAt: new Date('2024-02-01'),
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-02-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-02-01'),
  ...overrides,
});

// Stripe mocks
export const createMockStripeSubscription = (overrides = {}) => ({
  id: 'stripe_sub_123',
  customer: 'cus_123',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000) - 86400,
  current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
  items: {
    data: [
      {
        id: 'si_123',
        price: {
          id: 'price_123',
          unit_amount: 1000,
          currency: 'usd',
          recurring: { interval: 'month' },
        },
      },
    ],
  },
  metadata: {
    fan_id: 'user-123',
    creator_id: 'artist-123',
    tier_name: 'Basic Tier',
  },
  created: Math.floor(Date.now() / 1000) - 86400,
  cancel_at_period_end: false,
  ...overrides,
});

export const createMockStripePaymentIntent = (overrides = {}) => ({
  id: 'pi_123',
  amount: 1000,
  currency: 'usd',
  status: 'succeeded',
  payment_method_types: ['card'],
  client_secret: 'pi_123_secret_123',
  confirmation_method: 'automatic',
  created: Math.floor(Date.now() / 1000),
  charges: {
    data: [
      {
        id: 'ch_123',
        receipt_url: 'https://pay.stripe.com/receipts/123',
        payment_method_details: { type: 'card' },
      },
    ],
  },
  metadata: {
    fan_id: 'user-123',
    creator_id: 'artist-123',
    tier_name: 'Basic Tier',
  },
  last_payment_error: null,
  ...overrides,
});

export const createMockStripeInvoice = (overrides = {}) => ({
  id: 'in_stripe_123',
  subscription: 'stripe_sub_123',
  customer: 'cus_123',
  amount_paid: 1000,
  amount_due: 0,
  currency: 'usd',
  status: 'paid',
  number: 'INV-2024-001',
  period_start: Math.floor(Date.now() / 1000) - 86400,
  period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
  billing_reason: 'subscription_cycle',
  attempt_count: 1,
  next_payment_attempt: null,
  payment_intent: 'pi_123',
  metadata: {
    fan_id: 'user-123',
    creator_id: 'artist-123',
  },
  ...overrides,
});

export const createMockStripeDispute = (overrides = {}) => ({
  id: 'dp_123',
  amount: 1000,
  currency: 'usd',
  reason: 'fraudulent',
  status: 'under_review',
  charge: {
    id: 'ch_123',
    payment_intent: 'pi_123',
    payment_method_details: { type: 'card' },
    metadata: {
      fan_id: 'user-123',
      creator_id: 'artist-123',
    },
  },
  evidence_details: {
    due_by: Math.floor(Date.now() / 1000) + 86400 * 7,
  },
  is_charge_refundable: true,
  ...overrides,
});

// Mock Stripe SDK
export const mockStripe = {
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    list: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  },
  invoices: {
    create: jest.fn(),
    retrieve: jest.fn(),
    pay: jest.fn(),
    list: jest.fn(),
    upcoming: jest.fn(),
  },
  prices: {
    create: jest.fn(),
    retrieve: jest.fn(),
    list: jest.fn(),
  },
  products: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  webhookEndpoints: {
    create: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

// Mock Prisma with better type safety
export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  artist: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  tier: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  content: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  invoice: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  report: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  paymentFailure: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Authentication helpers
export const mockSession = (overrides: any = {}) => ({
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'fan',
    ...overrides.user,
  },
  expires: new Date(Date.now() + 86400 * 1000).toISOString(),
  ...overrides,
});

export const mockAuthenticatedRequest = (method = 'GET', body = {}, session = null) => {
  const request = new Request('http://localhost:3000/api/test', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });

  // Mock getServerSession for this request
  const { getServerSession } = require('next-auth');
  getServerSession.mockResolvedValue(session || mockSession());

  return request;
};

// Error helpers
export const createAppError = (code: string, message: string, statusCode = 400) => {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).statusCode = statusCode;
  (error as any).isOperational = true;
  return error;
};

// Date helpers for consistent testing
export const mockDateNow = (date: Date = new Date('2024-01-15T10:00:00Z')) => {
  const originalNow = Date.now;
  Date.now = jest.fn(() => date.getTime());
  return () => {
    Date.now = originalNow;
  };
};

// Business metrics testing helpers
export const mockBusinessMetrics = {
  track: jest.fn(),
  trackUserRegistration: jest.fn(),
  trackUserLogin: jest.fn(),
  trackPayment: jest.fn(),
  trackSubscription: jest.fn(),
  trackContent: jest.fn(),
  updateActiveUsers: jest.fn(),
  updateConversionRate: jest.fn(),
  updateARPU: jest.fn(),
  updateCustomerLTV: jest.fn(),
  getMetricsRegistry: jest.fn(),
  reset: jest.fn(),
};

// Payment monitoring helpers
export const mockPaymentMonitor = {
  trackPaymentIntentCreated: jest.fn(),
  trackPaymentSuccess: jest.fn(),
  trackPaymentFailure: jest.fn(),
  trackSubscriptionCreated: jest.fn(),
  trackSubscriptionUpdated: jest.fn(),
  trackSubscriptionCancelled: jest.fn(),
  trackInvoicePaid: jest.fn(),
  trackInvoicePaymentFailed: jest.fn(),
  trackDispute: jest.fn(),
};

// User engagement tracking helpers
export const mockUserEngagementTracker = {
  trackUserRegistration: jest.fn(),
  trackUserAuthentication: jest.fn(),
  trackContentInteraction: jest.fn(),
  trackCreatorActivity: jest.fn(),
  trackDiscoveryEvent: jest.fn(),
  trackRetentionEvent: jest.fn(),
  updateActiveUserMetrics: jest.fn(),
};

// File upload helpers
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1000) => ({
  name,
  type,
  size,
  lastModified: Date.now(),
});

export const mockS3Upload = {
  upload: (jest.fn() as any).mockResolvedValue({
    Location: 'https://s3.amazonaws.com/test-bucket/test.jpg',
    Key: 'test.jpg',
    Bucket: 'test-bucket',
    ETag: '"test-etag"',
  }),
  getSignedUrl: (jest.fn() as any).mockResolvedValue('https://signed-url.example.com'),
};

// Email/notification helpers
export const mockNotifications = {
  sendEmail: (jest.fn() as any).mockResolvedValue(true),
  sendNotification: (jest.fn() as any).mockResolvedValue(true),
  getUserNotificationPreferences: (jest.fn() as any).mockResolvedValue({
    newContent: true,
    comments: true,
    subscriptionUpdates: true,
  }),
};

// Test setup helpers
export const setupTestDatabase = () => {
  beforeEach(() => {
    // Reset all mocks
    Object.values(mockPrisma).forEach(mock => {
      if (typeof mock === 'object' && mock !== null) {
        Object.values(mock).forEach(method => {
          if (jest.isMockFunction(method)) {
            method.mockReset();
          }
        });
      }
    });
  });
};

export const setupTestStripe = () => {
  beforeEach(() => {
    // Reset all Stripe mocks
    Object.values(mockStripe).forEach(service => {
      Object.values(service).forEach(method => {
        if (jest.isMockFunction(method)) {
          method.mockReset();
        }
      });
    });
  });
};

export const setupTestAuth = () => {
  beforeEach(() => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockReset();
  });
};

// Complete test environment setup
export const setupTestEnvironment = () => {
  setupTestDatabase();
  setupTestStripe();
  setupTestAuth();

  beforeEach(() => {
    // Reset business metrics mocks
    Object.values(mockBusinessMetrics).forEach(method => {
      if (jest.isMockFunction(method)) {
        method.mockReset();
      }
    });

    // Reset payment monitoring mocks
    Object.values(mockPaymentMonitor).forEach(method => {
      if (jest.isMockFunction(method)) {
        method.mockReset();
      }
    });

    // Reset user engagement mocks
    Object.values(mockUserEngagementTracker).forEach(method => {
      if (jest.isMockFunction(method)) {
        method.mockReset();
      }
    });
  });
};

// Assertion helpers
export const expectBusinessMetricTracked = (eventName: string, properties?: any) => {
  expect(mockBusinessMetrics.track).toHaveBeenCalledWith(
    expect.objectContaining({
      event: eventName,
      ...(properties && { properties: expect.objectContaining(properties) }),
    })
  );
};

export const expectPaymentTracked = (eventName: string, amount?: number) => {
  const method = mockPaymentMonitor[eventName as keyof typeof mockPaymentMonitor];
  expect(method).toHaveBeenCalled();

  if (amount !== undefined) {
    expect(method).toHaveBeenCalledWith(expect.objectContaining({ amount }), expect.any(Object));
  }
};

export const expectUserEngagementTracked = (eventName: string, userId?: string) => {
  const method = mockUserEngagementTracker[eventName as keyof typeof mockUserEngagementTracker];
  expect(method).toHaveBeenCalled();

  if (userId) {
    expect(method).toHaveBeenCalledWith(expect.objectContaining({ userId }), expect.any(Object));
  }
};

// Export prisma mock
export const prisma = mockPrisma;

// User engagement tracking helpers - fix method names to match tests
export const userEngagementTracker = {
  trackSignup: jest.fn(),
  trackLogin: jest.fn(),
  trackContentView: jest.fn(),
  trackUserRegistration: jest.fn(),
  trackUserAuthentication: jest.fn(),
  trackContentInteraction: jest.fn(),
  trackCreatorActivity: jest.fn(),
  trackDiscoveryEvent: jest.fn(),
  trackRetentionEvent: jest.fn(),
  updateActiveUserMetrics: jest.fn(),
};

// Payment monitoring - fix method names
export const paymentMonitor = {
  trackPaymentIntentCreated: jest.fn(),
  trackPaymentSuccess: jest.fn(),
  trackPaymentFailure: jest.fn(),
  trackSubscriptionCreated: jest.fn(),
  trackSubscriptionUpdated: jest.fn(),
  trackSubscriptionCancelled: jest.fn(),
  trackInvoicePaid: jest.fn(),
  trackInvoicePaymentFailed: jest.fn(),
  trackDispute: jest.fn(),
};

// Business metrics - fix method names
export const businessMetrics = {
  track: jest.fn(),
  trackUserRegistration: jest.fn(),
  trackUserLogin: jest.fn(),
  trackPayment: jest.fn(),
  trackSubscription: jest.fn(),
  trackContent: jest.fn(),
  updateActiveUsers: jest.fn(),
  updateConversionRate: jest.fn(),
  updateARPU: jest.fn(),
  updateCustomerLTV: jest.fn(),
  getMetricsRegistry: jest.fn(),
  reset: jest.fn(),
};

// Export everything for easy importing
export * from '@testing-library/jest-dom';
export { render, screen, fireEvent, waitFor } from '@testing-library/react';
export {
  jest,
  expect,
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
