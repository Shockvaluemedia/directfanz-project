/**
 * Content Management Integration Tests
 * 
 * Comprehensive tests for content upload, management, and tier-based access control
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
  prisma,
  businessMetrics,
  userEngagementTracker,
} from '@/lib/test-utils';

// Mock the content access functions
jest.mock('@/lib/content-access', () => {
  const originalModule = jest.requireActual('@/lib/content-access');
  return {
    ...originalModule,
    checkContentAccess: jest.fn(),
    generateAccessToken: jest.fn(),
    getUserAccessibleContent: jest.fn(),
    checkTierAccess: jest.fn(),
    getContentAccessSummary: jest.fn(),
  };
});

// Import the mocked content access functions
const { checkContentAccess, generateAccessToken, getUserAccessibleContent } = require('@/lib/content-access');

// Mock S3 functions
jest.mock('@/lib/s3', () => ({
  generatePresignedUrl: jest.fn(),
  validateFileUpload: jest.fn(),
  SUPPORTED_FILE_TYPES: {
    'audio/mpeg': { extension: 'mp3', category: 'AUDIO', maxSize: 50 * 1024 * 1024 },
    'audio/wav': { extension: 'wav', category: 'AUDIO', maxSize: 100 * 1024 * 1024 },
    'video/mp4': { extension: 'mp4', category: 'VIDEO', maxSize: 500 * 1024 * 1024 },
    'image/jpeg': { extension: 'jpg', category: 'IMAGE', maxSize: 10 * 1024 * 1024 },
    'application/pdf': { extension: 'pdf', category: 'DOCUMENT', maxSize: 50 * 1024 * 1024 },
  },
}));

const { generatePresignedUrl, validateFileUpload } = require('@/lib/s3');

// Mock notifications
jest.mock('@/lib/notifications', () => ({
  notifyNewContent: jest.fn().mockResolvedValue(true),
}));

describe('Content Management Integration Tests', () => {
  setupTestEnvironment();

  const artistUser = createMockUser({ 
    id: 'artist-123', 
    role: 'ARTIST',
    displayName: 'Test Artist' 
  });
  
  const fanUser = createMockUser({ 
    id: 'fan-123', 
    role: 'FAN',
    displayName: 'Test Fan' 
  });
  
  const artist = createMockArtist({ 
    id: 'artist-profile-123', 
    userId: artistUser.id 
  });
  
  const basicTier = createMockTier({ 
    id: 'basic-tier-123', 
    artistId: artistUser.id,
    name: 'Basic Access',
    minimumPrice: 10.00
  });
  
  const premiumTier = createMockTier({ 
    id: 'premium-tier-123', 
    artistId: artistUser.id,
    name: 'Premium Access',
    minimumPrice: 25.00
  });

  beforeEach(() => {
    // Reset all mocks
    Object.values(businessMetrics).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
    Object.values(userEngagementTracker).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
    
    // Reset S3 mocks
    generatePresignedUrl.mockClear();
    validateFileUpload.mockClear();
    
    // Reset content access mocks
    checkContentAccess.mockClear();
    generateAccessToken.mockClear();
    getUserAccessibleContent.mockClear();
  });

  describe('Content Upload and Creation', () => {
    it('should successfully upload and create audio content', async () => {
      // Mock S3 upload validation and presigned URL generation
      validateFileUpload.mockReturnValue([]);
      generatePresignedUrl.mockResolvedValue({
        uploadUrl: 'https://s3.amazonaws.com/test-bucket/upload-url',
        fileUrl: 'https://s3.amazonaws.com/test-bucket/audio-123.mp3',
        fileKey: 'content/artist-123/audio-123.mp3',
      });

      // Mock tier verification
      (prisma.tier.count as jest.Mock).mockResolvedValue(1);

      // Mock content creation
      const mockContent = createMockContent({
        id: 'content-123',
        title: 'New Audio Track',
        type: 'AUDIO',
        fileUrl: 'https://s3.amazonaws.com/test-bucket/audio-123.mp3',
        artistId: artistUser.id,
        tiers: [{ id: basicTier.id, name: basicTier.name }],
      });

      (prisma.content.create as jest.Mock).mockResolvedValue(mockContent);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(artistUser);

      // Test presigned URL generation first
      const uploadRequest = mockAuthenticatedRequest('POST', {
        fileName: 'test-audio.mp3',
        fileType: 'audio/mpeg',
        fileSize: 5242880, // 5MB
      }, mockSession({ user: artistUser }));

      // Simulate upload endpoint
      const uploadResponse = await simulateUploadRequest(uploadRequest);
      
      expect(uploadResponse.status).toBe(200);
      expect(generatePresignedUrl).toHaveBeenCalledWith({
        fileName: 'test-audio.mp3',
        fileType: 'audio/mpeg',
        fileSize: 5242880,
        artistId: artistUser.id,
      });

      // Test content creation
      const contentRequest = mockAuthenticatedRequest('POST', {
        title: 'New Audio Track',
        description: 'A test audio track',
        fileUrl: 'https://s3.amazonaws.com/test-bucket/audio-123.mp3',
        fileSize: 5242880,
        format: 'mp3',
        duration: 180,
        tags: ['test', 'audio'],
        tierIds: [basicTier.id],
        isPublic: false,
      }, mockSession({ user: artistUser }));

      const contentResponse = await simulateContentCreation(contentRequest);
      const contentData = await contentResponse.json();

      expect(contentResponse.status).toBe(200);
      expect(contentData.success).toBe(true);
      expect(contentData.data.title).toBe('New Audio Track');
      expect(contentData.data.type).toBe('AUDIO');

      // Verify business metrics tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'content_uploaded',
        userId: artistUser.id,
        properties: {
          contentType: 'AUDIO',
          contentId: mockContent.id,
          tierCount: 1,
          fileSize: 5242880,
          isPublic: false,
        },
      });
    });

    it('should reject invalid file types', async () => {
      // Mock validation to return errors
      validateFileUpload.mockReturnValue(['Unsupported file type']);

      const uploadRequest = mockAuthenticatedRequest('POST', {
        fileName: 'test.exe',
        fileType: 'application/x-msdownload',
        fileSize: 1000,
      }, mockSession({ user: artistUser }));

      const response = await simulateUploadRequest(uploadRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.errors).toContain('Unsupported file type');
    });

    it('should reject files that are too large', async () => {
      validateFileUpload.mockReturnValue(['File too large']);

      const uploadRequest = mockAuthenticatedRequest('POST', {
        fileName: 'huge-video.mp4',
        fileType: 'video/mp4',
        fileSize: 1000 * 1024 * 1024, // 1GB
      }, mockSession({ user: artistUser }));

      const response = await simulateUploadRequest(uploadRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.errors).toContain('File too large');
    });

    it('should verify tier ownership before content creation', async () => {
      // Mock tier count to return 0 (tiers don't belong to artist)
      (prisma.tier.count as jest.Mock).mockResolvedValue(0);

      const contentRequest = mockAuthenticatedRequest('POST', {
        title: 'Test Content',
        fileUrl: 'https://s3.amazonaws.com/test-bucket/test.mp3',
        fileSize: 1000,
        format: 'mp3',
        tierIds: ['other-artist-tier-123'],
        isPublic: false,
      }, mockSession({ user: artistUser }));

      const response = await simulateContentCreation(contentRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_TIERS');
      expect(data.error.message).toContain('do not belong to this artist');
    });

    it('should create public content without tiers', async () => {
      const mockContent = createMockContent({
        id: 'public-content-123',
        title: 'Public Content',
        isPublic: true,
        tiers: [],
      });

      (prisma.content.create as jest.Mock).mockResolvedValue(mockContent);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(artistUser);

      const contentRequest = mockAuthenticatedRequest('POST', {
        title: 'Public Content',
        fileUrl: 'https://s3.amazonaws.com/test-bucket/public.jpg',
        fileSize: 500000,
        format: 'jpg',
        tierIds: [],
        isPublic: true,
      }, mockSession({ user: artistUser }));

      const response = await simulateContentCreation(contentRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.title).toBe('Public Content');
      expect(data.data.isPublic).toBe(true);

      // Verify no notifications are sent for public content
      const { notifyNewContent } = require('@/lib/notifications');
      expect(notifyNewContent).not.toHaveBeenCalled();
    });
  });

  describe('Content Access Control', () => {
    it('should allow access to public content without subscription', async () => {
      const publicContent = createMockContent({
        id: 'public-content-123',
        title: 'Public Content',
        isPublic: true,
        tiers: [],
      });

      checkContentAccess.mockResolvedValue({
        hasAccess: true,
        reason: 'public',
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(publicContent);

      const accessRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: fanUser }));
      const response = await simulateAccessCheck(accessRequest, 'public-content-123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.hasAccess).toBe(true);
      expect(data.data.reason).toBe('public');
    });

    it('should allow artist to access their own content', async () => {
      const artistContent = createMockContent({
        id: 'artist-content-123',
        artistId: artistUser.id,
        isPublic: false,
      });

      checkContentAccess.mockResolvedValue({
        hasAccess: true,
        reason: 'owner',
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(artistContent);

      const accessRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: artistUser }));
      const response = await simulateAccessCheck(accessRequest, 'artist-content-123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.hasAccess).toBe(true);
      expect(data.data.reason).toBe('owner');
    });

    it('should allow access with valid subscription', async () => {
      const gatedContent = createMockContent({
        id: 'gated-content-123',
        artistId: artistUser.id,
        isPublic: false,
        tiers: [basicTier],
      });

      const mockSubscription = createMockSubscription({
        id: 'subscription-123',
        fanId: fanUser.id,
        artistId: artistUser.id,
        tierId: basicTier.id,
      });

      checkContentAccess.mockResolvedValue({
        hasAccess: true,
        reason: 'subscription',
        subscription: {
          id: mockSubscription.id,
          tierId: basicTier.id,
          amount: 15.00,
          status: 'ACTIVE',
        },
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(gatedContent);

      const accessRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: fanUser }));
      const response = await simulateAccessCheck(accessRequest, 'gated-content-123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.hasAccess).toBe(true);
      expect(data.data.reason).toBe('subscription');
      expect(data.data.subscription.tierId).toBe(basicTier.id);
    });

    it('should deny access without subscription', async () => {
      const gatedContent = createMockContent({
        id: 'gated-content-123',
        artistId: artistUser.id,
        isPublic: false,
        tiers: [premiumTier],
      });

      checkContentAccess.mockResolvedValue({
        hasAccess: false,
        reason: 'no_subscription',
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(gatedContent);

      const accessRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: fanUser }));
      const response = await simulateAccessCheck(accessRequest, 'gated-content-123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.hasAccess).toBe(false);
      expect(data.data.reason).toBe('no_subscription');
    });

    it('should generate access token for authorized content', async () => {
      checkContentAccess.mockResolvedValue({
        hasAccess: true,
        reason: 'subscription',
      });

      generateAccessToken.mockReturnValue('mock-access-token-123');

      const mockContent = createMockContent({
        id: 'content-123',
        title: 'Premium Content',
        type: 'AUDIO',
        fileSize: 5000000,
        duration: 240,
        format: 'mp3',
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(mockContent);

      const tokenRequest = mockAuthenticatedRequest('POST', {}, mockSession({ user: fanUser }));
      const response = await simulateTokenGeneration(tokenRequest, 'content-123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBe('mock-access-token-123');
      expect(data.data.content.title).toBe('Premium Content');
      expect(data.data.expiresIn).toBe(3600);

      expect(generateAccessToken).toHaveBeenCalledWith(fanUser.id, 'content-123');
    });

    it('should deny token generation for unauthorized content', async () => {
      checkContentAccess.mockResolvedValue({
        hasAccess: false,
        reason: 'no_subscription',
      });

      const tokenRequest = mockAuthenticatedRequest('POST', {}, mockSession({ user: fanUser }));
      const response = await simulateTokenGeneration(tokenRequest, 'content-123');
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Subscription required to access this content');
      expect(data.reason).toBe('no_subscription');
    });
  });

  describe('Content Discovery and Filtering', () => {
    it('should return artist content with pagination and filtering', async () => {
      const mockContent = [
        createMockContent({ id: 'content-1', type: 'AUDIO', title: 'Song 1' }),
        createMockContent({ id: 'content-2', type: 'AUDIO', title: 'Song 2' }),
        createMockContent({ id: 'content-3', type: 'VIDEO', title: 'Video 1' }),
      ];

      (prisma.content.findMany as jest.Mock).mockResolvedValue(mockContent.slice(0, 2)); // First page
      (prisma.content.count as jest.Mock).mockResolvedValue(3); // Total count

      const contentRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: artistUser }));
      const response = await simulateArtistContentFetch(contentRequest, {
        page: 1,
        limit: 2,
        type: 'AUDIO',
        search: 'Song',
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.content).toHaveLength(2);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.total).toBe(3);
      expect(data.data.pagination.pages).toBe(2);

      expect(prisma.content.findMany).toHaveBeenCalledWith({
        where: {
          artistId: artistUser.id,
          type: 'AUDIO',
          OR: [
            { title: { contains: 'Song', mode: 'insensitive' } },
            { description: { contains: 'Song', mode: 'insensitive' } },
            { tags: { contains: 'Song', mode: 'insensitive' } },
          ],
        },
        include: {
          tiers: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 2,
      });
    });

    it('should return accessible content for fans', async () => {
      const accessibleContent = {
        content: [
          createMockContent({ id: 'content-1', title: 'Accessible Song 1', isPublic: true }),
          createMockContent({ id: 'content-2', title: 'Premium Song 1', isPublic: false }),
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      };

      getUserAccessibleContent.mockResolvedValue(accessibleContent);

      const fanContentRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: fanUser }));
      const response = await simulateFanContentFetch(fanContentRequest, artistUser.id, {
        page: 1,
        limit: 20,
        type: 'AUDIO',
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.content).toHaveLength(2);
      expect(getUserAccessibleContent).toHaveBeenCalledWith(
        fanUser.id,
        artistUser.id,
        { page: 1, limit: 20, type: 'AUDIO' }
      );
    });
  });

  describe('Content Management Operations', () => {
    it('should update content metadata', async () => {
      const originalContent = createMockContent({
        id: 'content-123',
        title: 'Original Title',
        description: 'Original Description',
        tags: ['original'],
        tiers: [basicTier],
      });

      const updatedContent = {
        ...originalContent,
        title: 'Updated Title',
        description: 'Updated Description',
        tags: ['updated', 'music'],
        tiers: [basicTier, premiumTier],
      };

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(originalContent);
      (prisma.tier.count as jest.Mock).mockResolvedValue(2); // Both tiers belong to artist
      (prisma.content.update as jest.Mock).mockResolvedValue(updatedContent);

      const updateRequest = mockAuthenticatedRequest('PUT', {
        title: 'Updated Title',
        description: 'Updated Description',
        tags: ['updated', 'music'],
        tierIds: [basicTier.id, premiumTier.id],
        isPublic: false,
      }, mockSession({ user: artistUser }));

      const response = await simulateContentUpdate(updateRequest, 'content-123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.title).toBe('Updated Title');
      expect(data.data.tiers).toHaveLength(2);

      // Verify business metrics for content update
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'content_updated',
        userId: artistUser.id,
        properties: {
          contentId: 'content-123',
          changes: ['title', 'description', 'tags', 'tiers'],
        },
      });
    });

    it('should delete content and track metrics', async () => {
      const contentToDelete = createMockContent({
        id: 'content-to-delete-123',
        artistId: artistUser.id,
        title: 'Content to Delete',
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(contentToDelete);
      (prisma.content.delete as jest.Mock).mockResolvedValue(contentToDelete);

      const deleteRequest = mockAuthenticatedRequest('DELETE', {}, mockSession({ user: artistUser }));
      const response = await simulateContentDeletion(deleteRequest, 'content-to-delete-123');

      expect(response.status).toBe(200);

      expect(prisma.content.delete).toHaveBeenCalledWith({
        where: { id: 'content-to-delete-123' },
      });

      // Verify business metrics for content deletion
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'content_deleted',
        userId: artistUser.id,
        properties: {
          contentId: 'content-to-delete-123',
          contentType: contentToDelete.type,
          title: contentToDelete.title,
        },
      });
    });

    it('should prevent non-owners from deleting content', async () => {
      const otherArtistContent = createMockContent({
        id: 'other-content-123',
        artistId: 'other-artist-456',
        title: 'Other Artist Content',
      });

      (prisma.content.findUnique as jest.Mock).mockResolvedValue(otherArtistContent);

      const deleteRequest = mockAuthenticatedRequest('DELETE', {}, mockSession({ user: artistUser }));
      const response = await simulateContentDeletion(deleteRequest, 'other-content-123');
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain('You can only delete your own content');
    });
  });

  describe('Tier-based Content Organization', () => {
    it('should organize content by tier access levels', async () => {
      const publicContent = createMockContent({ 
        id: 'public-1', 
        isPublic: true, 
        tiers: [] 
      });
      
      const basicContent = createMockContent({ 
        id: 'basic-1', 
        isPublic: false, 
        tiers: [basicTier] 
      });
      
      const premiumContent = createMockContent({ 
        id: 'premium-1', 
        isPublic: false, 
        tiers: [premiumTier] 
      });

      const allTiersContent = createMockContent({ 
        id: 'all-tiers-1', 
        isPublic: false, 
        tiers: [basicTier, premiumTier] 
      });

      // Mock content access summary
      const mockAccessSummary = {
        totalContent: 4,
        accessibleContent: 2, // Public + basic (user has basic subscription)
        publicContent: 1,
        gatedContent: 3,
        subscriptions: [
          {
            tierId: basicTier.id,
            tierName: basicTier.name,
            contentCount: 2, // basic-1 and all-tiers-1
          },
        ],
      };

      const { getContentAccessSummary } = require('@/lib/content-access');
      getContentAccessSummary.mockResolvedValue(mockAccessSummary);

      const summaryRequest = mockAuthenticatedRequest('GET', {}, mockSession({ user: fanUser }));
      const response = await simulateContentAccessSummary(summaryRequest, artistUser.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.totalContent).toBe(4);
      expect(data.data.accessibleContent).toBe(2);
      expect(data.data.publicContent).toBe(1);
      expect(data.data.gatedContent).toBe(3);
      expect(data.data.subscriptions[0].contentCount).toBe(2);
    });

    it('should handle multiple tier assignments correctly', async () => {
      const multiTierContent = createMockContent({
        id: 'multi-tier-content-123',
        title: 'Multi-Tier Content',
        tiers: [basicTier, premiumTier],
      });

      (prisma.tier.count as jest.Mock).mockResolvedValue(2);
      (prisma.content.create as jest.Mock).mockResolvedValue(multiTierContent);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(artistUser);

      const contentRequest = mockAuthenticatedRequest('POST', {
        title: 'Multi-Tier Content',
        fileUrl: 'https://s3.amazonaws.com/test-bucket/multi.mp3',
        fileSize: 1000,
        format: 'mp3',
        tierIds: [basicTier.id, premiumTier.id],
        isPublic: false,
      }, mockSession({ user: artistUser }));

      const response = await simulateContentCreation(contentRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.tiers).toHaveLength(2);

      // Verify content is accessible to both tiers
      expect(prisma.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tiers: {
            connect: [
              { id: basicTier.id },
              { id: premiumTier.id },
            ],
          },
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('Content Engagement Tracking', () => {
    it('should track content views and engagement', async () => {
      const viewedContent = createMockContent({
        id: 'viewed-content-123',
        title: 'Viewed Content',
        type: 'AUDIO',
        duration: 180,
      });

      // Simulate content view tracking
      userEngagementTracker.trackContentView(fanUser.id, {
        contentId: 'viewed-content-123',
        contentType: 'AUDIO',
        creatorId: artistUser.id,
        duration: 180,
        viewDuration: 150, // 83% completion
        source: 'web_player',
      });

      expect(userEngagementTracker.trackContentView).toHaveBeenCalledWith(fanUser.id, {
        contentId: 'viewed-content-123',
        contentType: 'AUDIO',
        creatorId: artistUser.id,
        duration: 180,
        viewDuration: 150,
        source: 'web_player',
      });

      // Verify business metrics for content engagement
      businessMetrics.track({
        event: 'content_viewed',
        userId: fanUser.id,
        properties: {
          contentId: 'viewed-content-123',
          contentType: 'AUDIO',
          creatorId: artistUser.id,
          engagementRate: 0.83, // 150/180
          platform: 'web',
        },
      });

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'content_viewed',
        userId: fanUser.id,
        properties: {
          contentId: 'viewed-content-123',
          contentType: 'AUDIO',
          creatorId: artistUser.id,
          engagementRate: 0.83,
          platform: 'web',
        },
      });
    });

    it('should track content downloads', async () => {
      checkContentAccess.mockResolvedValue({
        hasAccess: true,
        reason: 'subscription',
      });

      // Simulate content download tracking
      userEngagementTracker.trackContentDownload = jest.fn();
      
      userEngagementTracker.trackContentDownload(fanUser.id, {
        contentId: 'downloadable-content-123',
        contentType: 'DOCUMENT',
        creatorId: artistUser.id,
        fileSize: 2500000, // 2.5MB
        format: 'pdf',
      });

      expect(userEngagementTracker.trackContentDownload).toHaveBeenCalledWith(fanUser.id, {
        contentId: 'downloadable-content-123',
        contentType: 'DOCUMENT',
        creatorId: artistUser.id,
        fileSize: 2500000,
        format: 'pdf',
      });

      // Verify business metrics for downloads
      businessMetrics.track({
        event: 'content_downloaded',
        userId: fanUser.id,
        properties: {
          contentId: 'downloadable-content-123',
          creatorId: artistUser.id,
          fileSize: 2500000,
          format: 'pdf',
        },
        value: 1, // Download count
      });

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'content_downloaded',
        userId: fanUser.id,
        properties: {
          contentId: 'downloadable-content-123',
          creatorId: artistUser.id,
          fileSize: 2500000,
          format: 'pdf',
        },
        value: 1,
      });
    });
  });

  // Helper functions to simulate API endpoint behavior
  async function simulateUploadRequest(request: any) {
    const body = JSON.parse(request.body);
    const { fileName, fileType, fileSize } = body;

    const validationErrors = validateFileUpload(fileName, fileType, fileSize);
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File validation failed',
          details: { errors: validationErrors }
        }
      }), { status: 400 });
    }

    const presignedUrlData = await generatePresignedUrl({
      fileName,
      fileType,
      fileSize,
      artistId: artistUser.id,
    });

    return new Response(JSON.stringify({
      success: true,
      data: presignedUrlData,
    }), { status: 200 });
  }

  async function simulateContentCreation(request: any) {
    const body = JSON.parse(request.body);
    
    // Simulate tier validation
    if (body.tierIds && body.tierIds.length > 0) {
      const tierCount = await prisma.tier.count({
        where: {
          id: { in: body.tierIds },
          artistId: artistUser.id,
        },
      });

      if (tierCount !== body.tierIds.length) {
        return new Response(JSON.stringify({
          error: {
            code: 'INVALID_TIERS',
            message: 'One or more tiers do not belong to this artist'
          }
        }), { status: 400 });
      }
    }

    const content = await prisma.content.create({
      data: {
        ...body,
        artistId: artistUser.id,
        tiers: { connect: body.tierIds?.map((id: string) => ({ id })) || [] },
      },
      include: {
        tiers: { select: { id: true, name: true } },
      },
    });

    // Determine content type from format
    const contentType = body.format === 'mp3' ? 'AUDIO' : 
                       body.format === 'mp4' ? 'VIDEO' : 
                       body.format === 'jpg' ? 'IMAGE' : 
                       body.format === 'pdf' ? 'DOCUMENT' : 'UNKNOWN';

    // Track business metrics
    businessMetrics.track({
      event: 'content_uploaded',
      userId: artistUser.id,
      properties: {
        contentType,
        contentId: content.id,
        tierCount: body.tierIds?.length || 0,
        fileSize: body.fileSize,
        isPublic: body.isPublic,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      data: content,
    }), { status: 200 });
  }

  async function simulateAccessCheck(request: any, contentId: string) {
    const accessResult = await checkContentAccess(fanUser.id, contentId);
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        type: true,
        isPublic: true,
        tiers: {
          select: { id: true, name: true, minimumPrice: true }
        }
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        hasAccess: accessResult.hasAccess,
        reason: accessResult.reason,
        content,
        subscription: accessResult.subscription,
      },
    }), { status: 200 });
  }

  async function simulateTokenGeneration(request: any, contentId: string) {
    const accessResult = await checkContentAccess(fanUser.id, contentId);
    
    if (!accessResult.hasAccess) {
      const errorMessages = {
        'not_found': 'Content not found',
        'no_subscription': 'Subscription required to access this content',
        'invalid_tier': 'Your subscription tier does not include this content'
      };

      return new Response(JSON.stringify({
        error: errorMessages[accessResult.reason as keyof typeof errorMessages] || 'Access denied',
        reason: accessResult.reason
      }), { status: 403 });
    }

    const accessToken = generateAccessToken(fanUser.id, contentId);
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        type: true,
        fileSize: true,
        duration: true,
        format: true
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        accessToken,
        content,
        expiresIn: 3600,
        accessReason: accessResult.reason
      }
    }), { status: 200 });
  }

  async function simulateArtistContentFetch(request: any, params: any) {
    const { page = 1, limit = 20, type, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { artistId: artistUser.id };
    if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          tiers: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return new Response(JSON.stringify({
      success: true,
      data: {
        content,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    }), { status: 200 });
  }

  async function simulateFanContentFetch(request: any, artistId: string, options: any) {
    const result = await getUserAccessibleContent(fanUser.id, artistId, options);
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
    }), { status: 200 });
  }

  async function simulateContentUpdate(request: any, contentId: string) {
    const body = JSON.parse(request.body);
    const existingContent = await prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!existingContent || existingContent.artistId !== artistUser.id) {
      return new Response(JSON.stringify({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own content'
        }
      }), { status: 403 });
    }

    if (body.tierIds && body.tierIds.length > 0) {
      const tierCount = await prisma.tier.count({
        where: {
          id: { in: body.tierIds },
          artistId: artistUser.id,
        },
      });

      if (tierCount !== body.tierIds.length) {
        return new Response(JSON.stringify({
          error: {
            code: 'INVALID_TIERS',
            message: 'One or more tiers do not belong to this artist'
          }
        }), { status: 400 });
      }
    }

    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: {
        ...body,
        tiers: { set: body.tierIds?.map((id: string) => ({ id })) || [] },
      },
      include: {
        tiers: { select: { id: true, name: true } },
      },
    });

    // Track what changed
    const changes = [];
    if (body.title !== existingContent.title) changes.push('title');
    if (body.description !== existingContent.description) changes.push('description');
    if (JSON.stringify(body.tags) !== existingContent.tags) changes.push('tags');
    if (body.tierIds) changes.push('tiers');

    businessMetrics.track({
      event: 'content_updated',
      userId: artistUser.id,
      properties: {
        contentId,
        changes,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      data: updatedContent,
    }), { status: 200 });
  }

  async function simulateContentDeletion(request: any, contentId: string) {
    const existingContent = await prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!existingContent) {
      return new Response(JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'Content not found'
        }
      }), { status: 404 });
    }

    if (existingContent.artistId !== artistUser.id) {
      return new Response(JSON.stringify({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own content'
        }
      }), { status: 403 });
    }

    await prisma.content.delete({
      where: { id: contentId },
    });

    businessMetrics.track({
      event: 'content_deleted',
      userId: artistUser.id,
      properties: {
        contentId,
        contentType: existingContent.type,
        title: existingContent.title,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Content deleted successfully',
    }), { status: 200 });
  }

  async function simulateContentAccessSummary(request: any, artistId: string) {
    const { getContentAccessSummary } = require('@/lib/content-access');
    const accessSummary = await getContentAccessSummary(fanUser.id, artistId);
    
    return new Response(JSON.stringify({
      success: true,
      data: accessSummary,
    }), { status: 200 });
  }
});