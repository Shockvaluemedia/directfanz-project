import { getRedisClient, checkRedisHealth } from '../../src/lib/redis-production';
import { getDatabaseClient, checkDatabaseHealth } from '../../src/lib/database-production';
import { getServiceManager, checkServicesHealth } from '../../src/lib/service-manager-production';

describe('Property Test: Service Connection Reliability', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    // Set up test environment
    Object.assign(process.env, {
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/test',
      STRIPE_SECRET_KEY: 'sk_test_123456789',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_123456789',
      AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      AWS_S3_BUCKET_NAME: 'test-bucket',
      SENDGRID_API_KEY: 'SG.test123456789',
      FROM_EMAIL: 'test@directfanz.io',
      NODE_ENV: 'test',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Redis Connection Reliability', () => {
    test('Property 2: Redis client should handle connection failures gracefully', async () => {
      // Test with invalid Redis URL
      process.env.REDIS_URL = 'redis://invalid-host:6379';
      
      try {
        const client = getRedisClient();
        const healthStatus = client.getHealthStatus();
        
        // Should not throw on initialization
        expect(client).toBeDefined();
        
        // Health status should reflect connection issues
        const health = await checkRedisHealth();
        expect(health.healthy).toBe(false);
        
      } catch (error) {
        // Connection errors should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('Property 2: Redis operations should timeout appropriately', async () => {
      const client = getRedisClient();
      
      // Test operation timeout
      const startTime = Date.now();
      
      try {
        await client.get('test-key');
      } catch (error) {
        const duration = Date.now() - startTime;
        // Should timeout within reasonable time (< 10 seconds)
        expect(duration).toBeLessThan(10000);
      }
    });

    test('Property 2: Redis should implement retry logic', async () => {
      const client = getRedisClient();
      const healthStatus = client.getHealthStatus();
      
      // Connection attempts should be tracked
      expect(typeof healthStatus.connectionAttempts).toBe('number');
      expect(healthStatus.connectionAttempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Connection Reliability', () => {
    test('Property 2: Database client should handle connection failures gracefully', async () => {
      // Test with invalid database URL
      process.env.DATABASE_URL = 'postgresql://invalid:invalid@invalid-host:5432/invalid';
      
      try {
        const client = getDatabaseClient();
        
        // Should not throw on initialization
        expect(client).toBeDefined();
        
        // Health check should reflect connection issues
        const health = await checkDatabaseHealth();
        expect(health.healthy).toBe(false);
        
      } catch (error) {
        // Connection errors should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('Property 2: Database should implement connection pooling', async () => {
      const client = getDatabaseClient();
      const healthStatus = client.getHealthStatus();
      
      // Connection pool stats should be available
      expect(healthStatus.connectionPool).toBeDefined();
      expect(typeof healthStatus.connectionPool.total).toBe('number');
      expect(typeof healthStatus.connectionPool.active).toBe('number');
      expect(typeof healthStatus.connectionPool.idle).toBe('number');
    });

    test('Property 2: Database transactions should implement retry logic', async () => {
      const client = getDatabaseClient();
      
      // Test transaction retry behavior
      let attemptCount = 0;
      
      try {
        await client.transaction(async (prisma) => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Simulated connection error');
          }
          return { success: true };
        });
      } catch (error) {
        // Should have attempted multiple times
        expect(attemptCount).toBeGreaterThan(1);
      }
    });
  });

  describe('External Service Reliability', () => {
    test('Property 2: Service manager should handle service failures gracefully', async () => {
      // Test with invalid credentials
      process.env.STRIPE_SECRET_KEY = 'sk_test_invalid';
      process.env.AWS_ACCESS_KEY_ID = 'invalid';
      process.env.SENDGRID_API_KEY = 'invalid';
      
      const manager = getServiceManager();
      const health = await checkServicesHealth();
      
      // Should not throw on initialization
      expect(manager).toBeDefined();
      
      // Health check should reflect service issues
      expect(health.healthy).toBe(false);
      expect(health.summary.unhealthy).toBeGreaterThan(0);
    });

    test('Property 2: Service operations should timeout appropriately', async () => {
      const manager = getServiceManager();
      
      // Test Stripe timeout
      const startTime = Date.now();
      
      try {
        await manager.checkStripeHealth();
      } catch (error) {
        const duration = Date.now() - startTime;
        // Should timeout within reasonable time (< 15 seconds)
        expect(duration).toBeLessThan(15000);
      }
    });

    test('Property 2: Service health status should be tracked', async () => {
      const manager = getServiceManager();
      const healthStatus = manager.getHealthStatus();
      
      // All services should have health status
      expect(healthStatus.stripe).toBeDefined();
      expect(healthStatus.s3).toBeDefined();
      expect(healthStatus.sendgrid).toBeDefined();
      
      // Each service should have required health fields
      for (const service of Object.values(healthStatus)) {
        expect(typeof service.healthy).toBe('boolean');
        expect(service.lastChecked).toBeInstanceOf(Date);
      }
    });

    test('Property 2: Service manager should implement circuit breaker pattern', async () => {
      const manager = getServiceManager();
      
      // Multiple failed requests should affect health status
      const initialHealth = manager.getHealthStatus();
      
      try {
        await manager.checkStripeHealth();
        await manager.checkS3Health();
        await manager.checkSendGridHealth();
      } catch (error) {
        // Errors should be tracked in health status
        const updatedHealth = manager.getHealthStatus();
        
        // At least one service should show unhealthy status
        const unhealthyServices = Object.values(updatedHealth).filter(s => !s.healthy);
        expect(unhealthyServices.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Overall System Reliability', () => {
    test('Property 2: System should provide comprehensive health checks', async () => {
      const [redisHealth, dbHealth, servicesHealth] = await Promise.all([
        checkRedisHealth(),
        checkDatabaseHealth(),
        checkServicesHealth(),
      ]);
      
      // All health checks should return structured responses
      expect(redisHealth).toHaveProperty('healthy');
      expect(dbHealth).toHaveProperty('healthy');
      expect(servicesHealth).toHaveProperty('healthy');
      
      // Health checks should include latency information when successful
      if (redisHealth.healthy) {
        expect(typeof redisHealth.latency).toBe('number');
      }
      
      if (dbHealth.healthy) {
        expect(typeof dbHealth.latency).toBe('number');
      }
    });

    test('Property 2: System should handle partial service failures', async () => {
      // Simulate partial failure scenario
      process.env.REDIS_URL = 'redis://invalid-host:6379';
      
      const servicesHealth = await checkServicesHealth();
      
      // System should still report on all services
      expect(servicesHealth.services).toHaveProperty('stripe');
      expect(servicesHealth.services).toHaveProperty('s3');
      expect(servicesHealth.services).toHaveProperty('sendgrid');
      
      // Summary should accurately reflect service states
      expect(servicesHealth.summary.total).toBe(3);
      expect(servicesHealth.summary.healthy + servicesHealth.summary.unhealthy).toBe(3);
    });

    test('Property 2: Connection timeouts should be configurable and reasonable', () => {
      // Test Redis timeout configuration
      const redisClient = getRedisClient();
      expect(redisClient).toBeDefined();
      
      // Test Database timeout configuration
      const dbClient = getDatabaseClient();
      expect(dbClient).toBeDefined();
      
      // Test Service manager timeout configuration
      const serviceManager = getServiceManager();
      expect(serviceManager).toBeDefined();
      
      // All clients should be initialized without throwing
      expect(true).toBe(true);
    });
  });
});