/**
 * Comprehensive Integration Tests for AI Agent APIs
 * Tests all new AI endpoints with authentication, data validation, and error handling
 */
const request = require('supertest');
const app = require('../server'); // Assuming you have an Express app
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('AI Agent Integration Tests', () => {
  let testUser, adminUser, testContent;
  let userToken, adminToken;

  beforeAll(async () => {
    // Create test users
    testUser = await prisma.users.create({
      data: {
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'ARTIST',
      }
    });

    adminUser = await prisma.users.create({
      data: {
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'ADMIN',
      }
    });

    // Create test content
    testContent = await prisma.content.create({
      data: {
        artistId: testUser.id,
        title: 'Test Content',
        description: 'Test content for AI moderation',
        type: 'IMAGE',
        fileUrl: 'https://example.com/test.jpg',
        format: 'jpeg',
        fileSize: 1024,
        tags: 'test,ai',
        status: 'PUBLISHED',
      }
    });

    // Generate tokens
    userToken = jwt.sign({ userId: testUser.id, role: 'ARTIST' }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.moderation_logs.deleteMany({});
    await prisma.price_optimizations.deleteMany({});
    await prisma.ai_agent_logs.deleteMany({});
    await prisma.content.deleteMany({});
    await prisma.users.deleteMany({});
    await prisma.$disconnect();
  });

  // AI Main Router Tests
  describe('/api/ai', () => {
    test('should return AI agents status', async () => {
      const response = await request(app)
        .get('/api/ai')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
      expect(response.body.agents).toContain('predictive-analytics');
      expect(response.body.agents).toContain('revenue-optimization');
      expect(response.body.agents).toContain('admin-operations');
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/ai')
        .expect(401);
    });
  });

  // Predictive Analytics Agent Tests
  describe('/api/ai/predictive-analytics', () => {
    test('GET - should return analytics insights', async () => {
      const response = await request(app)
        .get('/api/ai/predictive-analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('insights');
      expect(response.body).toHaveProperty('predictions');
      expect(response.body).toHaveProperty('recommendations');
    });

    test('POST - should process analytics task', async () => {
      const taskData = {
        task: 'trend_analysis',
        userId: testUser.id,
        timeframe: '30d'
      };

      const response = await request(app)
        .post('/api/ai/predictive-analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .send(taskData)
        .expect(200);

      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('status', 'processing');
    });

    test('should validate required fields', async () => {
      const invalidData = { task: 'invalid_task' };

      await request(app)
        .post('/api/ai/predictive-analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  // Revenue Optimization Agent Tests
  describe('/api/ai/revenue-optimization', () => {
    test('GET - should return revenue insights', async () => {
      const response = await request(app)
        .get('/api/ai/revenue-optimization')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentRevenue');
      expect(response.body).toHaveProperty('optimizationSuggestions');
      expect(response.body).toHaveProperty('projectedGrowth');
    });

    test('POST - should process optimization task', async () => {
      const taskData = {
        task: 'pricing_optimization',
        userId: testUser.id,
        targetMetric: 'revenue'
      };

      const response = await request(app)
        .post('/api/ai/revenue-optimization')
        .set('Authorization', `Bearer ${userToken}`)
        .send(taskData)
        .expect(200);

      expect(response.body).toHaveProperty('optimizationId');
      expect(response.body).toHaveProperty('recommendations');
    });
  });

  // Admin and Operations Agent Tests
  describe('/api/ai/admin-operations', () => {
    test('GET - should return system insights for admin', async () => {
      const response = await request(app)
        .get('/api/ai/admin-operations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('systemHealth');
      expect(response.body).toHaveProperty('userMetrics');
      expect(response.body).toHaveProperty('operationalInsights');
    });

    test('should deny access to non-admin users', async () => {
      await request(app)
        .get('/api/ai/admin-operations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('POST - should execute admin operations', async () => {
      const operationData = {
        operation: 'system_health_check',
        parameters: { includeMetrics: true }
      };

      const response = await request(app)
        .post('/api/ai/admin-operations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(operationData)
        .expect(200);

      expect(response.body).toHaveProperty('operationId');
      expect(response.body).toHaveProperty('results');
    });
  });

  // Stripe Revenue Integration Tests
  describe('/api/ai/revenue-stripe', () => {
    test('GET - should return Stripe revenue analysis', async () => {
      const response = await request(app)
        .get('/api/ai/revenue-stripe')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('revenueAnalysis');
      expect(response.body).toHaveProperty('optimizations');
    });

    test('POST - should create pricing optimization', async () => {
      const optimizationData = {
        action: 'optimize_pricing',
        priceId: 'price_test123',
        targetIncrease: 0.15
      };

      const response = await request(app)
        .post('/api/ai/revenue-stripe')
        .set('Authorization', `Bearer ${userToken}`)
        .send(optimizationData)
        .expect(200);

      expect(response.body).toHaveProperty('optimizationId');
      expect(response.body).toHaveProperty('testPriceId');
    });
  });

  // Content Moderation Tests
  describe('/api/ai/moderation', () => {
    test('POST - should moderate content', async () => {
      const moderationData = {
        contentIds: [testContent.id],
        moderationType: 'comprehensive'
      };

      const response = await request(app)
        .post('/api/ai/moderation')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(moderationData)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    test('GET - should return moderation queue for admin', async () => {
      const response = await request(app)
        .get('/api/ai/moderation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pendingReview');
      expect(response.body).toHaveProperty('statistics');
    });

    test('should require admin access', async () => {
      await request(app)
        .get('/api/ai/moderation')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    test('should handle missing authorization header', async () => {
      await request(app)
        .get('/api/ai/predictive-analytics')
        .expect(401);
    });

    test('should handle invalid JWT token', async () => {
      await request(app)
        .get('/api/ai/predictive-analytics')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    test('should handle malformed request body', async () => {
      await request(app)
        .post('/api/ai/predictive-analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .send('invalid json')
        .expect(400);
    });

    test('should handle non-existent endpoints', async () => {
      await request(app)
        .get('/api/ai/non-existent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  // Performance Tests
  describe('Performance Tests', () => {
    test('should respond within reasonable time limits', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/ai/predictive-analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(5).fill().map(() => 
        request(app)
          .get('/api/ai/predictive-analytics')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  // Data Validation Tests
  describe('Data Validation', () => {
    test('should validate task types for analytics', async () => {
      const invalidTask = {
        task: 'invalid_task_type',
        userId: testUser.id
      };

      await request(app)
        .post('/api/ai/predictive-analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidTask)
        .expect(400);
    });

    test('should validate user permissions for operations', async () => {
      const operationData = {
        operation: 'dangerous_operation'
      };

      await request(app)
        .post('/api/ai/admin-operations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(operationData)
        .expect(403);
    });
  });

  // Integration Tests
  describe('Cross-Service Integration', () => {
    test('should integrate with existing analytics data', async () => {
      const response = await request(app)
        .get('/api/ai/predictive-analytics')
        .query({ includeHistoricalData: true })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.insights).toBeDefined();
      expect(response.body.predictions).toBeDefined();
    });

    test('should integrate with content moderation flow', async () => {
      const moderationResponse = await request(app)
        .post('/api/ai/moderation')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contentIds: [testContent.id] })
        .expect(200);

      // Check that moderation log was created
      const moderationLog = await prisma.moderation_logs.findFirst({
        where: { contentId: testContent.id }
      });

      expect(moderationLog).toBeTruthy();
    });
  });
});

module.exports = { 
  testUser, 
  adminUser, 
  testContent,
  userToken,
  adminToken 
};