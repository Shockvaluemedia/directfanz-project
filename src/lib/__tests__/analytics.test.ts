import {
  calculateEarningsData,
  calculateSubscriberMetrics,
  calculateTierAnalytics,
  getRecentActivity,
  getArtistAnalytics,
  getEarningsForPeriod,
  getSubscriberGrowthForPeriod,
  getDailyEarningsSummary,
  getSubscriberCountPerTier,
  getChurnAnalysis,
} from '../analytics';
import { prisma } from '../prisma';

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    artist: {
      findUnique: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    tier: {
      findMany: jest.fn(),
    },
    content: {
      findMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Analytics Library', () => {
  const artistId = 'artist-123';
  const mockDate = new Date('2024-01-15T10:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('calculateEarningsData', () => {
    it('should calculate earnings data correctly', async () => {
      // Mock artist data
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'artist-profile-123',
        userId: artistId,
        totalEarnings: 1000.5,
        totalSubscribers: 10,
        stripeAccountId: 'acct_123',
        isStripeOnboarded: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock active subscriptions
      // Current date is 2024-01-15T10:00:00Z, so last 7 days is from 2024-01-08T10:00:00Z
      const mockSubscriptions = [
        { amount: 10.0, createdAt: new Date('2024-01-07T10:00:00Z') }, // This month, not this week (before Jan 8)
        { amount: 15.0, createdAt: new Date('2024-01-12T10:00:00Z') }, // This month, this week
        { amount: 20.0, createdAt: new Date('2024-01-14T10:00:00Z') }, // This week
        { amount: 25.0, createdAt: new Date('2024-01-15T09:00:00Z') }, // Today
      ];

      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(mockSubscriptions) // Active subscriptions
        .mockResolvedValueOnce([
          // Previous month subscriptions
          { amount: 30.0 },
          { amount: 20.0 },
        ]);

      const result = await calculateEarningsData(artistId);

      expect(result).toEqual({
        totalEarnings: 1000.5,
        monthlyEarnings: 70.0, // 10 + 15 + 20 + 25
        weeklyEarnings: 60.0, // 15 + 20 + 25 (last 7 days from Jan 8-15)
        dailyEarnings: 25.0, // 25 (today)
        yearlyEarnings: 70.0, // Same as monthly for this year
        earningsGrowth: 40.0, // (70 - 50) / 50 * 100
      });

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { userId: artistId },
        select: { totalEarnings: true },
      });
    });

    it('should handle zero earnings correctly', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'artist-profile-123',
        userId: artistId,
        totalEarnings: 0,
        totalSubscribers: 0,
        stripeAccountId: null,
        isStripeOnboarded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([]) // Active subscriptions
        .mockResolvedValueOnce([]); // Previous month subscriptions

      const result = await calculateEarningsData(artistId);

      expect(result).toEqual({
        totalEarnings: 0,
        monthlyEarnings: 0,
        weeklyEarnings: 0,
        dailyEarnings: 0,
        yearlyEarnings: 0,
        earningsGrowth: 0,
      });
    });
  });

  describe('calculateSubscriberMetrics', () => {
    it('should calculate subscriber metrics correctly', async () => {
      mockPrisma.subscription.count
        .mockResolvedValueOnce(25) // Total subscribers
        .mockResolvedValueOnce(20) // Active subscribers
        .mockResolvedValueOnce(5) // New subscribers this month
        .mockResolvedValueOnce(2); // Canceled subscribers this month

      const result = await calculateSubscriberMetrics(artistId);

      expect(result).toEqual({
        totalSubscribers: 25,
        activeSubscribers: 20,
        newSubscribers: 5,
        canceledSubscribers: 2,
        churnRate: expect.any(Number),
        retentionRate: expect.any(Number),
      });

      // Churn rate should be calculated as: canceled / (active + canceled - new) * 100
      // (2 / (20 + 2 - 5)) * 100 = 2/17 * 100 ≈ 11.76%
      expect(result.churnRate).toBeCloseTo(11.76, 1);
      expect(result.retentionRate).toBeCloseTo(88.24, 1);
    });

    it('should handle zero subscribers correctly', async () => {
      mockPrisma.subscription.count
        .mockResolvedValueOnce(0) // Total subscribers
        .mockResolvedValueOnce(0) // Active subscribers
        .mockResolvedValueOnce(0) // New subscribers this month
        .mockResolvedValueOnce(0); // Canceled subscribers this month

      const result = await calculateSubscriberMetrics(artistId);

      expect(result).toEqual({
        totalSubscribers: 0,
        activeSubscribers: 0,
        newSubscribers: 0,
        canceledSubscribers: 0,
        churnRate: 0,
        retentionRate: 100,
      });
    });
  });

  describe('calculateTierAnalytics', () => {
    it('should calculate tier analytics correctly', async () => {
      const mockTiers = [
        {
          id: 'tier-1',
          name: 'Basic',
          artistId,
          description: 'Basic tier',
          minimumPrice: 5.0,
          isActive: true,
          subscriberCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscriptions: [{ amount: 10.0 }, { amount: 15.0 }],
        },
        {
          id: 'tier-2',
          name: 'Premium',
          artistId,
          description: 'Premium tier',
          minimumPrice: 15.0,
          isActive: true,
          subscriberCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscriptions: [{ amount: 20.0 }],
        },
      ];

      mockPrisma.tiers.findMany.mockResolvedValue(mockTiers);

      const result = await calculateTierAnalytics(artistId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tierId: 'tier-1',
        tierName: 'Basic',
        subscriberCount: 2,
        monthlyRevenue: 25.0,
        averageAmount: 12.5,
        conversionRate: 0, // Placeholder
      });
      expect(result[1]).toEqual({
        tierId: 'tier-2',
        tierName: 'Premium',
        subscriberCount: 1,
        monthlyRevenue: 20.0,
        averageAmount: 20.0,
        conversionRate: 0, // Placeholder
      });

      // Should be sorted by monthly revenue (descending)
      expect(result[0].monthlyRevenue).toBeGreaterThan(result[1].monthlyRevenue);
    });
  });

  describe('getRecentActivity', () => {
    it('should get recent activity correctly', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          status: 'ACTIVE',
          amount: 10.0,
          createdAt: new Date('2024-01-14T10:00:00Z'),
          fan: { displayName: 'John Doe' },
          tier: { name: 'Basic' },
        },
        {
          id: 'sub-2',
          status: 'CANCELED',
          amount: 15.0,
          createdAt: new Date('2024-01-13T10:00:00Z'),
          fan: { displayName: 'Jane Smith' },
          tier: { name: 'Premium' },
        },
      ];

      const mockContent = [
        {
          id: 'content-1',
          title: 'New Song',
          type: 'AUDIO',
          createdAt: new Date('2024-01-12T10:00:00Z'),
        },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions);
      mockPrisma.content.findMany.mockResolvedValue(mockContent);

      const result = await getRecentActivity(artistId, 5);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'sub-1',
        type: 'subscription',
        description: 'John Doe subscribed to Basic',
        amount: 10.0,
        timestamp: new Date('2024-01-14T10:00:00Z'),
      });
      expect(result[1]).toEqual({
        id: 'sub-2',
        type: 'cancellation',
        description: 'Jane Smith canceled subscription to Premium',
        amount: 15.0,
        timestamp: new Date('2024-01-13T10:00:00Z'),
      });
      expect(result[2]).toEqual({
        id: 'content-1',
        type: 'content',
        description: 'Uploaded new audio: New Song',
        timestamp: new Date('2024-01-12T10:00:00Z'),
      });
    });
  });

  describe('getArtistAnalytics', () => {
    it('should get comprehensive analytics', async () => {
      // Mock all the individual functions
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'artist-profile-123',
        userId: artistId,
        totalEarnings: 1000,
        totalSubscribers: 10,
        stripeAccountId: 'acct_123',
        isStripeOnboarded: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock for calculateEarningsData calls
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([{ amount: 100, createdAt: new Date() }]) // Active subscriptions for earnings
        .mockResolvedValueOnce([]) // Previous month subscriptions for earnings
        // Mock for getRecentActivity calls
        .mockResolvedValueOnce([
          // Recent subscriptions with proper relations
          {
            id: 'sub-1',
            status: 'ACTIVE',
            amount: 100,
            createdAt: new Date(),
            fan: { displayName: 'Test Fan' },
            tier: { name: 'Test Tier' },
          },
        ]);

      mockPrisma.subscription.count
        .mockResolvedValueOnce(10) // Total subscribers
        .mockResolvedValueOnce(8) // Active subscribers
        .mockResolvedValueOnce(3) // New subscribers
        .mockResolvedValueOnce(1); // Canceled subscribers

      mockPrisma.tiers.findMany.mockResolvedValue([]);
      mockPrisma.content.findMany.mockResolvedValue([]);

      const result = await getArtistAnalytics(artistId);

      expect(result).toHaveProperty('earnings');
      expect(result).toHaveProperty('subscribers');
      expect(result).toHaveProperty('tiers');
      expect(result).toHaveProperty('recentActivity');
      expect(result.earnings.totalEarnings).toBe(1000);
      expect(result.subscribers.totalSubscribers).toBe(10);
    });
  });

  describe('getEarningsForPeriod', () => {
    it('should get earnings data for a specific period', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSubscriptions = [
        { amount: 10.0, createdAt: new Date('2024-01-05') },
        { amount: 15.0, createdAt: new Date('2024-01-05') },
        { amount: 20.0, createdAt: new Date('2024-01-10') },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await getEarningsForPeriod(artistId, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-05',
        earnings: 25.0, // 10 + 15
      });
      expect(result[1]).toEqual({
        date: '2024-01-10',
        earnings: 20.0,
      });
    });
  });

  describe('getSubscriberGrowthForPeriod', () => {
    it('should get subscriber growth data for a specific period', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSubscriptions = [
        {
          status: 'ACTIVE',
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-05'),
        },
        {
          status: 'CANCELED',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-10'),
        },
        {
          status: 'ACTIVE',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10'),
        },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await getSubscriberGrowthForPeriod(artistId, startDate, endDate);

      // Should have 3 entries: one for each date with activity
      expect(result).toHaveLength(3);

      // Check that dates are sorted and data is correct
      expect(result[0].date).toBe('2024-01-03');
      expect(result[0].newSubscribers).toBe(1); // Created on this date
      expect(result[0].canceledSubscribers).toBe(0);

      expect(result[1].date).toBe('2024-01-05');
      expect(result[1].newSubscribers).toBe(1);
      expect(result[1].canceledSubscribers).toBe(0);

      expect(result[2].date).toBe('2024-01-10');
      expect(result[2].newSubscribers).toBe(1);
      expect(result[2].canceledSubscribers).toBe(1); // Canceled on this date
    });
  });

  describe('getDailyEarningsSummary', () => {
    it('should get daily earnings summary correctly', async () => {
      const mockTodaysSubs = [{ amount: 25.0 }];
      const mockYesterdaysSubs = [{ amount: 20.0 }];
      const mockWeekSubs = [{ amount: 100.0 }, { amount: 25.0 }];
      const mockMonthSubs = [{ amount: 200.0 }, { amount: 100.0 }, { amount: 25.0 }];
      const mockLast30DaysSubs = [
        { amount: 300.0 },
        { amount: 200.0 },
        { amount: 100.0 },
        { amount: 25.0 },
      ];

      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(mockTodaysSubs)
        .mockResolvedValueOnce(mockYesterdaysSubs)
        .mockResolvedValueOnce(mockWeekSubs)
        .mockResolvedValueOnce(mockMonthSubs)
        .mockResolvedValueOnce(mockLast30DaysSubs);

      const result = await getDailyEarningsSummary(artistId);

      expect(result).toEqual({
        today: 25.0,
        yesterday: 20.0,
        thisWeek: 125.0, // 100 + 25
        thisMonth: 325.0, // 200 + 100 + 25
        dailyAverage: expect.closeTo(20.83, 2), // 625 / 30
        trend: 'up', // today > yesterday and today > dailyAverage
      });
    });

    it('should calculate trend correctly for down trend', async () => {
      const mockTodaysSubs = [{ amount: 10.0 }];
      const mockYesterdaysSubs = [{ amount: 25.0 }];
      const mockWeekSubs = [{ amount: 35.0 }];
      const mockMonthSubs = [{ amount: 35.0 }];
      const mockLast30DaysSubs = [{ amount: 600.0 }]; // High average

      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(mockTodaysSubs)
        .mockResolvedValueOnce(mockYesterdaysSubs)
        .mockResolvedValueOnce(mockWeekSubs)
        .mockResolvedValueOnce(mockMonthSubs)
        .mockResolvedValueOnce(mockLast30DaysSubs);

      const result = await getDailyEarningsSummary(artistId);

      expect(result.trend).toBe('down'); // today < yesterday and today < dailyAverage
      expect(result.dailyAverage).toBe(20.0); // 600 / 30
    });

    it('should calculate stable trend correctly', async () => {
      const mockTodaysSubs = [{ amount: 20.0 }];
      const mockYesterdaysSubs = [{ amount: 20.0 }];
      const mockWeekSubs = [{ amount: 40.0 }];
      const mockMonthSubs = [{ amount: 40.0 }];
      const mockLast30DaysSubs = [{ amount: 600.0 }];

      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(mockTodaysSubs)
        .mockResolvedValueOnce(mockYesterdaysSubs)
        .mockResolvedValueOnce(mockWeekSubs)
        .mockResolvedValueOnce(mockMonthSubs)
        .mockResolvedValueOnce(mockLast30DaysSubs);

      const result = await getDailyEarningsSummary(artistId);

      expect(result.trend).toBe('stable'); // today == yesterday
      expect(result.dailyAverage).toBe(20.0);
    });
  });

  describe('getSubscriberCountPerTier', () => {
    it('should get subscriber count per tier correctly', async () => {
      const mockTiers = [
        {
          id: 'tier-1',
          name: 'Basic',
          artistId,
          description: 'Basic tier',
          minimumPrice: 5.0,
          isActive: true,
          subscriberCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscriptions: [
            {
              id: 'sub-1',
              status: 'ACTIVE',
              amount: 10.0,
              createdAt: new Date('2024-01-10T10:00:00Z'),
              updatedAt: new Date('2024-01-10T10:00:00Z'),
            },
            {
              id: 'sub-2',
              status: 'ACTIVE',
              amount: 15.0,
              createdAt: new Date('2024-01-12T10:00:00Z'),
              updatedAt: new Date('2024-01-12T10:00:00Z'),
            },
            {
              id: 'sub-3',
              status: 'CANCELED',
              amount: 12.0,
              createdAt: new Date('2023-12-15T10:00:00Z'),
              updatedAt: new Date('2024-01-05T10:00:00Z'), // Canceled this month
            },
          ],
        },
        {
          id: 'tier-2',
          name: 'Premium',
          artistId,
          description: 'Premium tier',
          minimumPrice: 15.0,
          isActive: true,
          subscriberCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscriptions: [
            {
              id: 'sub-4',
              status: 'ACTIVE',
              amount: 20.0,
              createdAt: new Date('2024-01-08T10:00:00Z'),
              updatedAt: new Date('2024-01-08T10:00:00Z'),
            },
          ],
        },
      ];

      mockPrisma.tiers.findMany.mockResolvedValue(mockTiers);

      const result = await getSubscriberCountPerTier(artistId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tierId: 'tier-1',
        tierName: 'Basic',
        subscriberCount: 3, // Total including canceled
        activeSubscribers: 2, // Only active
        newThisMonth: 2, // Created in January 2024
        churnThisMonth: 1, // Canceled in January 2024
        revenue: 25.0, // 10 + 15 (only active)
      });
      expect(result[1]).toEqual({
        tierId: 'tier-2',
        tierName: 'Premium',
        subscriberCount: 1,
        activeSubscribers: 1,
        newThisMonth: 1,
        churnThisMonth: 0,
        revenue: 20.0,
      });
    });
  });

  describe('getChurnAnalysis', () => {
    it('should get comprehensive churn analysis', async () => {
      const mockAllSubs = [
        {
          id: 'sub-1',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          tierId: 'tier-1',
        },
        {
          id: 'sub-2',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-05'),
          tierId: 'tier-1',
        },
        {
          id: 'sub-3',
          status: 'CANCELED',
          createdAt: new Date('2023-12-01'),
          updatedAt: new Date('2024-01-10'),
          tierId: 'tier-1',
        },
        {
          id: 'sub-4',
          status: 'CANCELED',
          createdAt: new Date('2023-11-01'),
          updatedAt: new Date('2023-12-15'),
          tierId: 'tier-2',
        },
        {
          id: 'sub-5',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-12'),
          updatedAt: new Date('2024-01-12'),
          tierId: 'tier-2',
        },
      ];

      const mockTiers = [
        { id: 'tier-1', name: 'Basic' },
        { id: 'tier-2', name: 'Premium' },
      ];

      mockPrisma.subscription.findMany.mockResolvedValue(mockAllSubs);
      mockPrisma.tiers.findMany.mockResolvedValue(mockTiers);

      const result = await getChurnAnalysis(artistId);

      expect(result).toEqual({
        overallChurnRate: 40.0, // 2 canceled out of 5 total = 40%
        monthlyChurnRate: expect.any(Number), // 1 canceled this month
        churnByTier: [
          { tierId: 'tier-1', tierName: 'Basic', churnRate: expect.closeTo(33.33, 2) }, // 1 canceled out of 3 total
          { tierId: 'tier-2', tierName: 'Premium', churnRate: 50.0 }, // 1 canceled out of 2 total
        ],
        retentionRate: 60.0, // 100 - 40
        averageLifetime: expect.any(Number), // Average days between creation and cancellation
        churnReasons: expect.any(Array),
      });

      expect(result.churnReasons).toHaveLength(4);
      expect(result.churnReasons[0].reason).toBe('Price too high');
    });

    it('should handle zero churn correctly', async () => {
      const mockAllSubs = [
        {
          id: 'sub-1',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          tierId: 'tier-1',
        },
        {
          id: 'sub-2',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-05'),
          tierId: 'tier-1',
        },
      ];

      const mockTiers = [{ id: 'tier-1', name: 'Basic' }];

      mockPrisma.subscription.findMany.mockResolvedValue(mockAllSubs);
      mockPrisma.tiers.findMany.mockResolvedValue(mockTiers);

      const result = await getChurnAnalysis(artistId);

      expect(result.overallChurnRate).toBe(0);
      expect(result.retentionRate).toBe(100);
      expect(result.averageLifetime).toBe(0);
      expect(result.churnByTier[0].churnRate).toBe(0);
    });
  });
});
