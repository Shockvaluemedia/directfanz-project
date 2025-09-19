import { jest } from '@jest/globals';
import { logger } from '../src/lib/logger';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/directfan_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.UPLOADCARE_PUBLIC_KEY = 'test-public-key';
process.env.UPLOADCARE_SECRET_KEY = 'test-secret-key';

// Global test timeout
jest.setTimeout(30000);

// Mock logger in tests
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(() => Promise.resolve(null)),
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_mock',
        client_secret: 'pi_mock_secret',
        status: 'requires_payment_method',
        amount: 1000,
        currency: 'usd',
      }),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_mock',
        email: 'test@example.com',
      }),
      list: jest.fn().mockResolvedValue({ data: [] }),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: 'sub_mock',
        status: 'active',
        customer: 'cus_mock',
      }),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_mock',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      }),
    },
  }));
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn().mockResolvedValue([]),
    mset: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    incrby: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
  }));
});

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    artist: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    content: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
    $connect: jest.fn(),
  })),
}));

// Mock file upload
jest.mock('@uploadcare/upload-client', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    uuid: 'test-uuid',
    cdnUrl: 'https://ucarecdn.com/test-uuid/',
  }),
}));

// Global test helpers
global.testHelpers = {
  // Create mock user
  createMockUser: (overrides = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'FAN',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Create mock artist
  createMockArtist: (overrides = {}) => ({
    id: 'artist-1',
    userId: 'user-1',
    displayName: 'Test Artist',
    bio: 'Test bio',
    profileImage: 'https://example.com/profile.jpg',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Create mock subscription
  createMockSubscription: (overrides = {}) => ({
    id: 'sub-1',
    fanId: 'user-1',
    artistId: 'artist-1',
    stripeSubscriptionId: 'sub_mock',
    status: 'ACTIVE',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock API response
  mockApiResponse: (data: any, status = 200) => ({
    status,
    json: async () => data,
    ok: status >= 200 && status < 300,
  }),
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', reason => {
  logger.error('Unhandled Rejection in test:', {}, reason as Error);
});

export {};
