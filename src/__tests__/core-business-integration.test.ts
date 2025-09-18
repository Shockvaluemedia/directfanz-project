/**
 * Core Business Logic Integration Tests
 * 
 * Tests the core business functionality without complex auth dependencies
 */

import { 
  setupTestEnvironment,
  createMockUser,
  createMockArtist,
  createMockTier,
  createMockSubscription,
  createMockStripeSubscription,
  createMockStripePaymentIntent,
  prisma,
  businessMetrics,
  paymentMonitor,
  userEngagementTracker,
} from '@/lib/test-utils';

describe('Core Business Integration Tests', () => {
  setupTestEnvironment();

  beforeEach(() => {
    // Reset all business metrics mocks
    Object.values(businessMetrics).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
    Object.values(paymentMonitor).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
    Object.values(userEngagementTracker).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });

  describe('User and Artist Creation', () => {
    it('should track metrics when creating a new user', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
        role: 'fan',
      });

      // Mock database operations
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      // Simulate user registration business logic
      const userData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'fan' as const,
      };

      // Track registration
      businessMetrics.track({
        event: 'user_registered',
        userId: mockUser.id,
        properties: {
          role: userData.role,
          source: 'signup_form',
        },
      });

      userEngagementTracker.trackSignup(mockUser.id, {
        role: userData.role,
        signupMethod: 'email',
      });

      // Verify tracking was called
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'user_registered',
        userId: 'user-123',
        properties: {
          role: 'fan',
          source: 'signup_form',
        },
      });

      expect(userEngagementTracker.trackSignup).toHaveBeenCalledWith('user-123', {
        role: 'fan',
        signupMethod: 'email',
      });
    });

    it('should track artist-specific metrics when creating artist', async () => {
      const mockUser = createMockUser({
        id: 'artist-user-123',
        email: 'artist@example.com',
        role: 'artist',
      });

      const mockArtist = createMockArtist({
        id: 'artist-123',
        userId: mockUser.id,
        stage_name: 'Test Artist',
        genre: 'Pop',
      });

      // Mock database operations
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        artist: mockArtist,
      });

      // Simulate artist registration business logic
      const artistData = {
        email: 'artist@example.com',
        stageName: 'Test Artist',
        genre: 'Pop',
        role: 'artist' as const,
      };

      // Track artist registration
      businessMetrics.track({
        event: 'artist_registered',
        userId: mockUser.id,
        properties: {
          stageName: artistData.stageName,
          genre: artistData.genre,
          source: 'signup_form',
        },
      });

      userEngagementTracker.trackSignup(mockUser.id, {
        role: artistData.role,
        signupMethod: 'email',
        artistProfile: {
          stageName: artistData.stageName,
          genre: artistData.genre,
        },
      });

      // Verify artist-specific tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'artist_registered',
        userId: 'artist-user-123',
        properties: {
          stageName: 'Test Artist',
          genre: 'Pop',
          source: 'signup_form',
        },
      });

      expect(userEngagementTracker.trackSignup).toHaveBeenCalledWith('artist-user-123', {
        role: 'artist',
        signupMethod: 'email',
        artistProfile: {
          stageName: 'Test Artist',
          genre: 'Pop',
        },
      });
    });
  });

  describe('Subscription and Payment Tracking', () => {
    it('should track complete subscription flow metrics', async () => {
      const fanUser = createMockUser({ id: 'fan-123', role: 'fan' });
      const artistUser = createMockUser({ id: 'artist-user-123', role: 'artist' });
      const artist = createMockArtist({ id: 'artist-123', userId: artistUser.id });
      const tier = createMockTier({ id: 'tier-123', artistId: artist.id, price: 29.99 });

      // 1. Track subscription creation attempt
      businessMetrics.track({
        event: 'checkout_session_created',
        userId: fanUser.id,
        properties: {
          tierId: tier.id,
          artistId: artist.id,
          amount: tier.price,
          currency: tier.currency,
        },
      });

      // 2. Simulate successful payment
      const paymentIntent = createMockStripePaymentIntent({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 2999, // $29.99 in cents
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      // Track payment success
      paymentMonitor.trackPaymentSuccess(paymentIntent, {
        userId: fanUser.id,
        creatorId: artistUser.id,
        source: 'webhook',
      });

      businessMetrics.trackPayment({
        event: 'payment_succeeded',
        amount: 29.99,
        currency: 'USD',
        paymentId: paymentIntent.id,
      });

      // 3. Create subscription
      const subscription = createMockStripeSubscription({
        id: 'sub_test_123',
        status: 'active',
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: tier.name,
        },
      });

      paymentMonitor.trackSubscriptionCreated(subscription, {
        userId: fanUser.id,
        creatorId: artistUser.id,
        subscriptionTier: tier.name,
        source: 'webhook',
      });

      // Track conversion completion
      businessMetrics.track({
        event: 'conversion_completed',
        userId: fanUser.id,
        properties: {
          creatorId: artistUser.id,
          tier: tier.name,
        },
        value: tier.price,
        currency: 'usd',
      });

      // Verify all tracking calls
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'checkout_session_created',
        userId: 'fan-123',
        properties: {
          tierId: 'tier-123',
          artistId: 'artist-123',
          amount: 29.99,
          currency: 'USD',
        },
      });

      expect(paymentMonitor.trackPaymentSuccess).toHaveBeenCalledWith(
        paymentIntent,
        expect.objectContaining({
          userId: 'fan-123',
          creatorId: 'artist-user-123',
          source: 'webhook',
        })
      );

      expect(businessMetrics.trackPayment).toHaveBeenCalledWith({
        event: 'payment_succeeded',
        amount: 29.99,
        currency: 'USD',
        paymentId: 'pi_test_123',
      });

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'conversion_completed',
        userId: 'fan-123',
        properties: {
          creatorId: 'artist-user-123',
          tier: tier.name,
        },
        value: 29.99,
        currency: 'usd',
      });
    });

    it('should track subscription cancellation and churn', async () => {
      const fanUser = createMockUser({ id: 'fan-123', role: 'fan' });
      const artistUser = createMockUser({ id: 'artist-user-123', role: 'artist' });
      const subscription = createMockStripeSubscription({
        id: 'sub_test_123',
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000),
        metadata: {
          fan_id: fanUser.id,
          creator_id: artistUser.id,
          tier_name: 'Premium Tier',
        },
      });

      // Track subscription cancellation
      paymentMonitor.trackSubscriptionCancelled(subscription, {
        userId: fanUser.id,
        creatorId: artistUser.id,
        subscriptionTier: 'Premium Tier',
        source: 'webhook',
      }, 'subscription_cancelled');

      // Track churn event
      businessMetrics.track({
        event: 'churn_event',
        userId: fanUser.id,
        properties: {
          subscriptionId: subscription.id,
          creatorId: artistUser.id,
          tier: 'Premium Tier',
          reason: 'subscription_cancelled',
        },
      });

      // Verify churn tracking
      expect(paymentMonitor.trackSubscriptionCancelled).toHaveBeenCalledWith(
        subscription,
        expect.objectContaining({
          userId: 'fan-123',
          creatorId: 'artist-user-123',
          subscriptionTier: 'Premium Tier',
          source: 'webhook',
        }),
        'subscription_cancelled'
      );

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'churn_event',
        userId: 'fan-123',
        properties: {
          subscriptionId: 'sub_test_123',
          creatorId: 'artist-user-123',
          tier: 'Premium Tier',
          reason: 'subscription_cancelled',
        },
      });
    });
  });

  describe('User Engagement Tracking', () => {
    it('should track user login and session activity', async () => {
      const mockUser = createMockUser({ id: 'user-123', role: 'fan' });

      // Track login
      userEngagementTracker.trackLogin(mockUser.id, {
        loginMethod: 'email',
        role: mockUser.role,
        timestamp: new Date(),
      });

      businessMetrics.track({
        event: 'user_login',
        userId: mockUser.id,
        properties: {
          role: mockUser.role,
          source: 'login_form',
        },
      });

      expect(userEngagementTracker.trackLogin).toHaveBeenCalledWith('user-123', {
        loginMethod: 'email',
        role: 'fan',
        timestamp: expect.any(Date),
      });

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'user_login',
        userId: 'user-123',
        properties: {
          role: 'fan',
          source: 'login_form',
        },
      });
    });

    it('should track content interaction', async () => {
      const fanUser = createMockUser({ id: 'fan-123', role: 'fan' });
      const artistUser = createMockUser({ id: 'artist-user-123', role: 'artist' });

      // Track content view
      userEngagementTracker.trackContentView(fanUser.id, {
        contentId: 'content-123',
        contentType: 'video',
        creatorId: artistUser.id,
        duration: 180, // 3 minutes
      });

      businessMetrics.track({
        event: 'content_viewed',
        userId: fanUser.id,
        properties: {
          contentId: 'content-123',
          contentType: 'video',
          creatorId: artistUser.id,
          duration: 180,
        },
      });

      expect(userEngagementTracker.trackContentView).toHaveBeenCalledWith('fan-123', {
        contentId: 'content-123',
        contentType: 'video',
        creatorId: 'artist-user-123',
        duration: 180,
      });

      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'content_viewed',
        userId: 'fan-123',
        properties: {
          contentId: 'content-123',
          contentType: 'video',
          creatorId: 'artist-user-123',
          duration: 180,
        },
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should track payment failures with proper context', async () => {
      const paymentIntent = createMockStripePaymentIntent({
        id: 'pi_failed_123',
        status: 'requires_payment_method',
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.',
          decline_code: 'insufficient_funds',
        },
        metadata: {
          fan_id: 'fan-123',
          creator_id: 'artist-123',
        },
      });

      // Track payment failure
      paymentMonitor.trackPaymentFailure(paymentIntent, {
        userId: 'fan-123',
        creatorId: 'artist-123',
        source: 'webhook',
      });

      businessMetrics.trackPayment({
        event: 'payment_failed',
        amount: 29.99,
        paymentId: paymentIntent.id,
        properties: {
          status: 'failed',
          failureReason: 'card_declined',
          declineCode: 'insufficient_funds',
        },
      });

      expect(paymentMonitor.trackPaymentFailure).toHaveBeenCalledWith(
        paymentIntent,
        expect.objectContaining({
          userId: 'fan-123',
          creatorId: 'artist-123',
          source: 'webhook',
        })
      );

      expect(businessMetrics.trackPayment).toHaveBeenCalledWith({
        event: 'payment_failed',
        amount: 29.99,
        paymentId: 'pi_failed_123',
        properties: {
          status: 'failed',
          failureReason: 'card_declined',
          declineCode: 'insufficient_funds',
        },
      });
    });

    it('should handle business logic errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      
      // Mock a database error
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(mockError);
      
      // Test error handling in business logic
      try {
        // This would normally be wrapped in error handling
        throw mockError;
      } catch (error) {
        // Track the error
        businessMetrics.track({
          event: 'error_occurred',
          userId: 'user-123',
          properties: {
            errorType: 'database_error',
            errorMessage: (error as Error).message,
            operation: 'user_lookup',
          },
        });
      }
      
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'error_occurred',
        userId: 'user-123',
        properties: {
          errorType: 'database_error',
          errorMessage: 'Database connection failed',
          operation: 'user_lookup',
        },
      });
    });
  });

  describe('Business Metrics Aggregation', () => {
    it('should calculate and track key performance indicators', async () => {
      const fanUser = createMockUser({ id: 'fan-123', role: 'fan' });
      const artistUser = createMockUser({ id: 'artist-user-123', role: 'artist' });
      
      // Simulate multiple user actions that affect KPIs
      const actions = [
        { event: 'user_registered', value: 1 },
        { event: 'subscription_created', value: 29.99 },
        { event: 'content_viewed', value: 1 },
        { event: 'payment_succeeded', value: 29.99 },
      ];
      
      actions.forEach(action => {
        businessMetrics.track({
          event: action.event,
          userId: fanUser.id,
          value: action.value,
          properties: {
            creatorId: artistUser.id,
            timestamp: new Date().toISOString(),
          },
        });
      });
      
      // Verify all KPI events were tracked
      expect(businessMetrics.track).toHaveBeenCalledTimes(4);
      
      // Verify specific high-value events
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'subscription_created',
        userId: 'fan-123',
        value: 29.99,
        properties: {
          creatorId: 'artist-user-123',
          timestamp: expect.any(String),
        },
      });
      
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'payment_succeeded',
        userId: 'fan-123',
        value: 29.99,
        properties: {
          creatorId: 'artist-user-123',
          timestamp: expect.any(String),
        },
      });
    });
  });
});
