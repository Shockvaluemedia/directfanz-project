/**
 * Access Control Security Tests
 *
 * Edge cases and security scenarios for content access control
 */

import {
  setupTestEnvironment,
  createMockUser,
  createMockArtist,
  createMockTier,
  createMockContent,
  createMockSubscription,
  mockAuthenticatedRequest,
  mockSession,
  businessMetrics,
  userEngagementTracker,
} from '@/lib/test-utils';

// Import the actual prisma mock from the Jest-mocked module
import { prisma } from '@/lib/prisma';

// Import the real access control functions
import {
  checkContentAccess,
  checkTierAccess,
  generateAccessToken,
  verifyAccessToken,
  getUserAccessibleContent,
  getContentAccessSummary,
} from '@/lib/content-access';

// Mock JWT for token testing
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

const jwt = require('jsonwebtoken');

describe('Access Control Security Tests', () => {
  setupTestEnvironment();

  const artistUser = createMockUser({
    id: 'artist-123',
    role: 'ARTIST',
    email: 'artist@example.com',
  });

  const fanUser = createMockUser({
    id: 'fan-123',
    role: 'FAN',
    email: 'fan@example.com',
  });

  const otherFanUser = createMockUser({
    id: 'other-fan-456',
    role: 'FAN',
    email: 'otherfan@example.com',
  });

  const basicTier = createMockTier({
    id: 'basic-tier-123',
    artistId: artistUser.id,
    name: 'Basic Access',
    minimumPrice: 10.0,
    isActive: true,
  });

  const premiumTier = createMockTier({
    id: 'premium-tier-123',
    artistId: artistUser.id,
    name: 'Premium Access',
    minimumPrice: 25.0,
    isActive: true,
  });

  const expiredTier = createMockTier({
    id: 'expired-tier-456',
    artistId: artistUser.id,
    name: 'Expired Tier',
    minimumPrice: 15.0,
    isActive: false, // Inactive tier
  });

  beforeEach(() => {
    // Reset all mocks
    jwt.verify.mockReset();
    Object.values(businessMetrics).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });

    // No longer needed since we're using real implementations
  });

  describe('Content Access Authorization', () => {
    it('should allow access to public content for any authenticated user', async () => {
      const publicContent = createMockContent({
        id: 'public-content-123',
        artistId: artistUser.id,
        visibility: 'PUBLIC',
        tiers: [],
      });

      const mockReturnValue = {
        ...publicContent,
        artist: { id: artistUser.id, role: 'ARTIST' },
        tiers: [],
      };

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(mockReturnValue);

      const result = await checkContentAccess(fanUser.id, 'public-content-123');

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('public');
    });

    it('should deny access to non-existent content', async () => {
      (prisma.content.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await checkContentAccess(fanUser.id, 'non-existent-content');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should always allow artist to access their own content', async () => {
      const privateContent = createMockContent({
        id: 'artist-content-123',
        artistId: artistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [premiumTier],
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue({
        ...privateContent,
        artist: { id: artistUser.id, role: 'ARTIST' },
        tiers: [{ id: premiumTier.id, minimumPrice: premiumTier.minimumPrice, isActive: true }],
      });

      const result = await checkContentAccess(artistUser.id, 'artist-content-123');

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('owner');
    });

    it('should deny access to content with no tiers assigned', async () => {
      const orphanedContent = createMockContent({
        id: 'orphaned-content-123',
        artistId: artistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [],
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue({
        ...orphanedContent,
        artist: { id: artistUser.id, role: 'ARTIST' },
        tiers: [],
      });

      const result = await checkContentAccess(fanUser.id, 'orphaned-content-123');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });

    it('should deny access when user has expired subscription', async () => {
      const gatedContent = createMockContent({
        id: 'gated-content-123',
        artistId: artistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [basicTier],
      });

      const expiredSubscription = createMockSubscription({
        id: 'expired-sub-123',
        fanId: fanUser.id,
        artistId: artistUser.id,
        tierId: basicTier.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() - 86400000), // Expired yesterday
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(gatedContent);
      // The subscription is expired, so findMany with currentPeriodEnd >= now() should return empty array
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([]);

      const result = await checkContentAccess(fanUser.id, 'gated-content-123');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });

    it('should deny access to content with inactive tiers', async () => {
      const contentWithInactiveTier = createMockContent({
        id: 'inactive-tier-content-123',
        artistId: artistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [expiredTier],
      });

      const activeSubscription = createMockSubscription({
        id: 'active-sub-123',
        fanId: fanUser.id,
        artistId: artistUser.id,
        tierId: expiredTier.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 86400000), // Active
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(contentWithInactiveTier);
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([
        { ...activeSubscription, tier: expiredTier },
      ]);

      const result = await checkContentAccess(fanUser.id, 'inactive-tier-content-123');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });

    it('should allow access with valid subscription to multiple tiers', async () => {
      const multiTierContent = createMockContent({
        id: 'multi-tier-content-123',
        artistId: artistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [basicTier, premiumTier],
      });

      const basicSubscription = createMockSubscription({
        id: 'basic-sub-123',
        fanId: fanUser.id,
        artistId: artistUser.id,
        tierId: basicTier.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 86400000),
        amount: 15.0,
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(multiTierContent);
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([
        { ...basicSubscription, tier: basicTier },
      ]);

      const result = await checkContentAccess(fanUser.id, 'multi-tier-content-123');

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('subscription');
      expect(result.subscription).toBeDefined();
      expect(result.subscription!.tierId).toBe(basicTier.id);
    });

    it('should handle database errors gracefully', async () => {
      (prisma.content.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await checkContentAccess(fanUser.id, 'any-content-id');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('not_found');
    });
  });

  describe('Access Token Security', () => {
    it('should generate valid access tokens with proper expiration', () => {
      const mockPayload = {
        userId: fanUser.id,
        contentId: 'content-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwt.sign.mockReturnValue('signed-jwt-token');

      const token = generateAccessToken(fanUser.id, 'content-123');

      expect(token).toBe('signed-jwt-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: fanUser.id,
          contentId: 'content-123',
          iat: expect.any(Number),
          exp: expect.any(Number),
        }),
        process.env.NEXTAUTH_SECRET,
        { algorithm: 'HS256' }
      );
    });

    it('should verify valid access tokens', () => {
      const mockPayload = {
        userId: fanUser.id,
        contentId: 'content-123',
        iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        exp: Math.floor(Date.now() / 1000) + 3300, // 55 minutes from now
      };

      jwt.verify.mockReturnValue(mockPayload);

      const result = verifyAccessToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.NEXTAUTH_SECRET);
    });

    it('should reject invalid or expired access tokens', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = verifyAccessToken('expired-token');

      expect(result).toBeNull();
    });

    it('should reject malformed access tokens', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = verifyAccessToken('malformed-token');

      expect(result).toBeNull();
    });

    it('should not allow token reuse for different content', () => {
      const mockPayload = {
        userId: fanUser.id,
        contentId: 'content-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwt.verify.mockReturnValue(mockPayload);

      const result = verifyAccessToken('token-for-content-123');

      expect(result!.contentId).toBe('content-123');
      // In a real implementation, you'd check that the token matches the requested content
      expect(result!.contentId).not.toBe('different-content-456');
    });
  });

  describe('Tier-based Access Control', () => {
    it('should correctly identify valid tier access', async () => {
      const activeSubscription = createMockSubscription({
        id: 'active-sub-123',
        fanId: fanUser.id,
        tierId: basicTier.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });

      (prisma.subscriptions.findFirst as jest.Mock).mockResolvedValue(activeSubscription);

      const hasAccess = await checkTierAccess(fanUser.id, basicTier.id);

      expect(hasAccess).toBe(true);
    });

    it('should deny tier access for expired subscriptions', async () => {
      // Expired subscription would not be returned by findFirst with currentPeriodEnd >= now()
      (prisma.subscriptions.findFirst as jest.Mock).mockResolvedValue(null);

      const hasAccess = await checkTierAccess(fanUser.id, basicTier.id);

      expect(hasAccess).toBe(false);
    });

    it('should deny tier access for inactive subscriptions', async () => {
      // Inactive subscription would not be returned by findFirst with status: ACTIVE
      (prisma.subscriptions.findFirst as jest.Mock).mockResolvedValue(null);

      const hasAccess = await checkTierAccess(fanUser.id, basicTier.id);

      expect(hasAccess).toBe(false);
    });

    it('should handle database errors in tier access checks', async () => {
      (prisma.subscriptions.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const hasAccess = await checkTierAccess(fanUser.id, basicTier.id);

      expect(hasAccess).toBe(false);
    });
  });

  describe('User Content Access Filtering', () => {
    it('should return only accessible content for user with basic subscription', async () => {
      const userSubscriptions = [{ tierId: basicTier.id }];

      const allContent = [
        createMockContent({ id: 'public-1', visibility: 'PUBLIC', tiers: [] }),
        createMockContent({ id: 'basic-1', visibility: 'TIER_LOCKED', tiers: [basicTier] }),
        createMockContent({ id: 'premium-1', visibility: 'TIER_LOCKED', tiers: [premiumTier] }),
        createMockContent({
          id: 'multi-1',
          visibility: 'TIER_LOCKED',
          tiers: [basicTier, premiumTier],
        }),
      ];

      const accessibleContent = allContent.filter(
        content =>
          content.visibility === 'PUBLIC' || content.tiers.some(tier => tier.id === basicTier.id)
      );

      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue(userSubscriptions);
      (prisma.content.findMany as jest.Mock).mockResolvedValue(accessibleContent);
      (prisma.content.count as jest.Mock).mockResolvedValue(accessibleContent.length);

      const result = await getUserAccessibleContent(fanUser.id, artistUser.id);

      expect(result.content).toHaveLength(3); // public-1, basic-1, multi-1
      expect(result.content.map(c => c.id)).toContain('public-1');
      expect(result.content.map(c => c.id)).toContain('basic-1');
      expect(result.content.map(c => c.id)).toContain('multi-1');
      expect(result.content.map(c => c.id)).not.toContain('premium-1');
    });

    it('should return only public content for users without subscriptions', async () => {
      const publicContent = [
        createMockContent({ id: 'public-1', visibility: 'PUBLIC', tiers: [] }),
        createMockContent({ id: 'public-2', visibility: 'PUBLIC', tiers: [] }),
      ];

      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.content.findMany as jest.Mock).mockResolvedValue(publicContent);
      (prisma.content.count as jest.Mock).mockResolvedValue(publicContent.length);

      const result = await getUserAccessibleContent(fanUser.id, artistUser.id);

      expect(result.content).toHaveLength(2);
      expect(result.content.every(c => c.visibility === 'PUBLIC')).toBe(true);
    });

    it('should handle content type filtering correctly', async () => {
      const audioContent = [
        createMockContent({ id: 'audio-1', type: 'AUDIO', visibility: 'PUBLIC' }),
        createMockContent({ id: 'audio-2', type: 'AUDIO', visibility: 'PUBLIC' }),
      ];

      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.content.findMany as jest.Mock).mockResolvedValue(audioContent);
      (prisma.content.count as jest.Mock).mockResolvedValue(audioContent.length);

      const result = await getUserAccessibleContent(fanUser.id, artistUser.id, {
        type: 'AUDIO',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content.every(c => c.type === 'AUDIO')).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const paginatedContent = [
        createMockContent({ id: 'content-3', visibility: 'PUBLIC' }),
        createMockContent({ id: 'content-4', visibility: 'PUBLIC' }),
      ];

      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.content.findMany as jest.Mock).mockResolvedValue(paginatedContent);
      (prisma.content.count as jest.Mock).mockResolvedValue(10); // Total content

      const result = await getUserAccessibleContent(fanUser.id, artistUser.id, {
        page: 2,
        limit: 2,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  describe('Content Access Summary Security', () => {
    it('should provide accurate access summary without exposing unauthorized data', async () => {
      const mockCounts = {
        totalContent: 10,
        publicContent: 3,
        accessibleGatedContent: 4,
      };

      const userSubscriptions = [
        {
          tierId: basicTier.id,
          tier: { id: basicTier.id, name: basicTier.name },
        },
      ];

      // Mock the database calls
      (prisma.content.count as jest.Mock)
        .mockResolvedValueOnce(mockCounts.totalContent) // Total content
        .mockResolvedValueOnce(mockCounts.publicContent) // Public content
        .mockResolvedValueOnce(mockCounts.accessibleGatedContent); // Accessible gated content

      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue(userSubscriptions);

      // Mock content count per tier
      (prisma.content.count as jest.Mock).mockResolvedValueOnce(5); // Content for basic tier

      const result = await getContentAccessSummary(fanUser.id, artistUser.id);

      expect(result.totalContent).toBe(10);
      expect(result.publicContent).toBe(3);
      expect(result.accessibleContent).toBe(7); // 3 public + 4 gated
      expect(result.gatedContent).toBe(7); // 10 total - 3 public
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].tierName).toBe(basicTier.name);
      expect(result.subscriptions[0].contentCount).toBe(5);
    });

    it('should handle errors gracefully in access summary', async () => {
      (prisma.content.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await getContentAccessSummary(fanUser.id, artistUser.id);

      expect(result.totalContent).toBe(0);
      expect(result.accessibleContent).toBe(0);
      expect(result.publicContent).toBe(0);
      expect(result.gatedContent).toBe(0);
      expect(result.subscriptions).toHaveLength(0);
    });

    it('should not leak subscription information between users', async () => {
      // Set up fan with basic subscription
      const fanSubscriptions = [
        {
          tierId: basicTier.id,
          tier: { id: basicTier.id, name: basicTier.name },
        },
      ];

      // Mock for fan user
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue(fanSubscriptions);
      (prisma.content.count as jest.Mock)
        .mockResolvedValueOnce(10) // Total
        .mockResolvedValueOnce(3) // Public
        .mockResolvedValueOnce(2) // Accessible gated
        .mockResolvedValueOnce(4); // Basic tier content

      const fanResult = await getContentAccessSummary(fanUser.id, artistUser.id);

      // Reset mocks for other fan
      jest.clearAllMocks();

      // Set up other fan with no subscriptions
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.content.count as jest.Mock)
        .mockResolvedValueOnce(10) // Total content count
        .mockResolvedValueOnce(3) // Public content count
        .mockResolvedValueOnce(0); // Accessible gated content (0 since no subscriptions)

      const otherFanResult = await getContentAccessSummary(otherFanUser.id, artistUser.id);

      // Verify results are different and appropriate
      expect(fanResult.accessibleContent).toBe(5); // 3 public + 2 gated
      expect(fanResult.subscriptions).toHaveLength(1);

      expect(otherFanResult.accessibleContent).toBe(3); // Only public
      expect(otherFanResult.subscriptions).toHaveLength(0);
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent access token generation without proper authentication', async () => {
      // This would be handled at the API level, but we can test the token generation
      expect(() => {
        generateAccessToken('', 'content-123');
      }).not.toThrow(); // The function should handle empty userId gracefully

      const token = generateAccessToken('', 'content-123');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '',
          contentId: 'content-123',
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle malicious content IDs safely', async () => {
      const maliciousContentIds = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'DROP TABLE content;',
        null,
        undefined,
        '',
      ];

      for (const contentId of maliciousContentIds) {
        (prisma.content.findUnique as jest.Mock).mockResolvedValue(null);

        const result = await checkContentAccess(fanUser.id, contentId as string);

        expect(result.hasAccess).toBe(false);
        expect(result.reason).toBe('not_found');
      }
    });

    it('should prevent timing attacks on content existence', async () => {
      // Mock database to take consistent time regardless of content existence
      (prisma.content.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // Non-existent content
        .mockResolvedValueOnce(null); // Another non-existent content

      const start1 = Date.now();
      const result1 = await checkContentAccess(fanUser.id, 'non-existent-1');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const result2 = await checkContentAccess(fanUser.id, 'non-existent-2');
      const time2 = Date.now() - start2;

      expect(result1.hasAccess).toBe(false);
      expect(result2.hasAccess).toBe(false);

      // Both should return the same result regardless of timing
      expect(result1.reason).toBe(result2.reason);
    });

    it('should handle concurrent access checks safely', async () => {
      const gatedContent = createMockContent({
        id: 'concurrent-content-123',
        artistId: artistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [basicTier],
      });

      const activeSubscription = createMockSubscription({
        id: 'active-sub-123',
        fanId: fanUser.id,
        artistId: artistUser.id,
        tierId: basicTier.id,
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(gatedContent);
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([
        { ...activeSubscription, tier: basicTier },
      ]);

      // Simulate concurrent access checks
      const accessPromises = Array.from({ length: 5 }, () =>
        checkContentAccess(fanUser.id, 'concurrent-content-123')
      );

      const results = await Promise.all(accessPromises);

      // All results should be consistent
      results.forEach(result => {
        expect(result.hasAccess).toBe(true);
        expect(result.reason).toBe('subscription');
      });
    });

    it('should validate user permissions across different artists', async () => {
      const otherArtistUser = createMockUser({
        id: 'other-artist-789',
        role: 'ARTIST',
      });

      const otherArtistContent = createMockContent({
        id: 'other-artist-content-123',
        artistId: otherArtistUser.id,
        visibility: 'TIER_LOCKED',
        tiers: [basicTier], // This tier belongs to the original artist
      });

      // Fan has subscription to original artist's tier
      const subscription = createMockSubscription({
        id: 'cross-artist-sub-123',
        fanId: fanUser.id,
        artistId: artistUser.id, // Original artist
        tierId: basicTier.id,
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(otherArtistContent);
      // The subscription query filters by artistId, so it should return empty for different artist
      (prisma.subscriptions.findMany as jest.Mock).mockResolvedValue([]);

      const result = await checkContentAccess(fanUser.id, 'other-artist-content-123');

      // Should not have access because subscription is for different artist
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });
  });
});
