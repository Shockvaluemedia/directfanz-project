// Mock dependencies first
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    subscriptions: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/billing-cycle', () => ({
  getBillingCycleInfo: jest.fn(),
  getUpcomingInvoices: jest.fn(),
  getBillingCycleStats: jest.fn(),
  processBillingRenewals: jest.fn(),
  processFailedPaymentRetries: jest.fn(),
  sendBillingReminders: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { GET, POST } from '../cycle/route';
import { prisma } from '@/lib/prisma';
import {
  getBillingCycleInfo,
  getUpcomingInvoices,
  getBillingCycleStats,
  processBillingRenewals,
  processFailedPaymentRetries,
  sendBillingReminders,
} from '@/lib/billing-cycle';
import { getServerSession } from 'next-auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetBillingCycleInfo = getBillingCycleInfo as jest.MockedFunction<
  typeof getBillingCycleInfo
>;
const mockGetUpcomingInvoices = getUpcomingInvoices as jest.MockedFunction<
  typeof getUpcomingInvoices
>;
const mockGetBillingCycleStats = getBillingCycleStats as jest.MockedFunction<
  typeof getBillingCycleStats
>;
const mockProcessBillingRenewals = processBillingRenewals as jest.MockedFunction<
  typeof processBillingRenewals
>;
const mockProcessFailedPaymentRetries = processFailedPaymentRetries as jest.MockedFunction<
  typeof processFailedPaymentRetries
>;
const mockSendBillingReminders = sendBillingReminders as jest.MockedFunction<
  typeof sendBillingReminders
>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Helper functions to create mock requests
function createMockGetRequest(url: string) {
  return new Request(url) as any;
}

function createMockPostRequest(url: string, body: any) {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any;
}

describe('/api/billing/cycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return billing info for valid subscription', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      const mockSubscription = {
        id: 'sub123',
        fanId: 'fan123',
      };

      const mockBillingInfo = {
        currentPeriodStart: new Date('2022-01-01'),
        currentPeriodEnd: new Date('2022-02-01'),
        nextBillingDate: new Date('2022-02-01'),
        daysInCurrentPeriod: 31,
        daysRemaining: 15,
      };

      const expectedBillingInfo = {
        currentPeriodStart: '2022-01-01T00:00:00.000Z',
        currentPeriodEnd: '2022-02-01T00:00:00.000Z',
        nextBillingDate: '2022-02-01T00:00:00.000Z',
        daysInCurrentPeriod: 31,
        daysRemaining: 15,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscriptions.findUnique.mockResolvedValue(mockSubscription as any);
      mockGetBillingCycleInfo.mockResolvedValue(mockBillingInfo);

      const request = createMockGetRequest(
        'http://localhost:3000/api/billing/cycle?action=info&subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.billingInfo).toEqual(expectedBillingInfo);
      expect(mockGetBillingCycleInfo).toHaveBeenCalledWith('sub123');
    });

    it('should return upcoming invoices for artist', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      const mockUpcomingInvoices = [
        {
          subscriptionId: 'sub1',
          amount: 10.0,
          dueDate: new Date('2022-02-01'),
          periodStart: new Date('2022-01-01'),
          periodEnd: new Date('2022-02-01'),
        },
        {
          subscriptionId: 'sub2',
          amount: 15.0,
          dueDate: new Date('2022-02-01'),
          periodStart: new Date('2022-01-01'),
          periodEnd: new Date('2022-02-01'),
        },
      ];

      const mockArtistSubscriptions = [{ id: 'sub1' }, { id: 'sub2' }];

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockGetUpcomingInvoices.mockResolvedValue(mockUpcomingInvoices);
      mockPrisma.subscriptions.findMany.mockResolvedValue(mockArtistSubscriptions as any);

      const request = createMockGetRequest(
        'http://localhost:3000/api/billing/cycle?action=upcoming'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.upcomingInvoices).toHaveLength(2);
      expect(data.upcomingInvoices[0].subscriptionId).toBe('sub1');
      expect(data.upcomingInvoices[1].subscriptionId).toBe('sub2');
    });

    it('should return billing stats for artist', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      const mockStats = {
        activeSubscriptions: 100,
        upcomingRenewals: 15,
        failedPayments: 5,
        totalMonthlyRevenue: 2500.0,
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockGetBillingCycleStats.mockResolvedValue(mockStats);

      const request = createMockGetRequest('http://localhost:3000/api/billing/cycle?action=stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual(mockStats);
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockGetRequest(
        'http://localhost:3000/api/billing/cycle?action=info&subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing subscriptionId in info action', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockGetRequest('http://localhost:3000/api/billing/cycle?action=info');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing subscriptionId parameter');
    });

    it('should return 404 for subscription not found', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockPrisma.subscriptions.findUnique.mockResolvedValue(null);

      const request = createMockGetRequest(
        'http://localhost:3000/api/billing/cycle?action=info&subscriptionId=sub123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Subscription not found');
    });

    it('should return 403 for fan trying to access upcoming invoices', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockGetRequest(
        'http://localhost:3000/api/billing/cycle?action=upcoming'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only artists can view upcoming invoices');
    });

    it('should return 403 for fan trying to access stats', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockGetRequest('http://localhost:3000/api/billing/cycle?action=stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only artists can view billing statistics');
    });

    it('should return 400 for invalid action', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockGetRequest(
        'http://localhost:3000/api/billing/cycle?action=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action parameter');
    });
  });

  describe('POST', () => {
    it('should process billing renewals', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      const fixedTimestamp = new Date('2025-09-14T23:33:14.309Z');
      const mockEvents = [
        {
          type: 'renewal' as const,
          subscriptionId: 'sub1',
          amount: 10.0,
          timestamp: fixedTimestamp,
        },
      ];

      const expectedEvents = [
        {
          type: 'renewal',
          subscriptionId: 'sub1',
          amount: 10.0,
          timestamp: '2025-09-14T23:33:14.309Z',
        },
      ];

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockProcessBillingRenewals.mockResolvedValue(mockEvents);

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'process-renewals',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Billing renewals processed');
      expect(data.events).toEqual(expectedEvents);
    });

    it('should process payment retries', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      const fixedTimestamp = new Date('2025-09-14T23:33:14.310Z');
      const mockEvents = [
        {
          type: 'retry' as const,
          subscriptionId: 'sub1',
          amount: 10.0,
          timestamp: fixedTimestamp,
          metadata: { resolved: true },
        },
      ];

      const expectedEvents = [
        {
          type: 'retry',
          subscriptionId: 'sub1',
          amount: 10.0,
          timestamp: '2025-09-14T23:33:14.310Z',
          metadata: { resolved: true },
        },
      ];

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockProcessFailedPaymentRetries.mockResolvedValue(mockEvents);

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'process-retries',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Payment retries processed');
      expect(data.events).toEqual(expectedEvents);
    });

    it('should send billing reminders', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockSendBillingReminders.mockResolvedValue(5);

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'send-reminders',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Billing reminders sent');
      expect(data.count).toBe(5);
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'process-renewals',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for fan user', async () => {
      const mockSession = {
        user: { id: 'fan123', role: 'FAN' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'process-renewals',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only artists can trigger billing processes');
    });

    it('should return 400 for invalid action', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'invalid-action',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should return 500 for server errors', async () => {
      const mockSession = {
        user: { id: 'artist123', role: 'ARTIST' },
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);
      mockProcessBillingRenewals.mockRejectedValue(new Error('Processing failed'));

      const request = createMockPostRequest('http://localhost:3000/api/billing/cycle', {
        action: 'process-renewals',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process billing cycle action');
    });
  });
});
