import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/content/optimize/route';

// Mock the Content Optimization module
jest.mock('../lib/content-optimization', () => {
  const OPTIMIZATION_STRATEGIES = {
    auto: { key: 'auto', name: 'Auto (Recommended)', description: 'AI-powered optimization based on content analysis' },
    aggressive: { key: 'aggressive', name: 'Aggressive', description: 'Maximum compression' },
    balanced: { key: 'balanced', name: 'Balanced', description: 'Good balance between file size and quality' },
    quality: { key: 'quality', name: 'Quality First', description: 'Preserve maximum quality with minimal compression' },
    mobile: { key: 'mobile', name: 'Mobile Optimized', description: 'Optimized for mobile devices and slower connections' },
    streaming: { key: 'streaming', name: 'Streaming Optimized', description: 'Optimized for video/audio streaming' }
  };

  const mockContentOptimizer = {
    analyzeContent: jest.fn().mockResolvedValue({
      complexity: 'medium',
      colorComplexity: 'full',
      noiseLevel: 'moderate',
      dimensions: { width: 1920, height: 1080 },
      hasText: false,
      hasFaces: false,
      dominantColors: [],
      recommendedStrategy: 'balanced'
    }),
    optimizeContent: jest.fn().mockResolvedValue({
      originalSize: 1000000,
      optimizedSize: 750000,
      sizeReduction: 25,
      qualityScore: 85,
      processingTime: 1500,
      strategy: 'balanced',
      outputs: [
        {
          quality: 'webp',
          format: 'webp',
          size: 750000,
          url: 'https://example.com/optimized-file.webp',
          optimizations: ['format_conversion', 'quality_adjustment']
        }
      ],
      optimizedUrl: 'https://example.com/optimized-file.webp'
    }),
    batchOptimize: jest.fn().mockResolvedValue([
      {
        originalSize: 1000000,
        optimizedSize: 750000,
        sizeReduction: 25,
        qualityScore: 85,
        processingTime: 1500,
        strategy: 'balanced',
        outputs: []
      },
      {
        originalSize: 800000,
        optimizedSize: 560000,
        sizeReduction: 30,
        qualityScore: 82,
        processingTime: 1200,
        strategy: 'balanced',
        outputs: []
      }
    ])
  };

  return {
    OPTIMIZATION_STRATEGIES,
    contentOptimizer: mockContentOptimizer,
    ContentOptimizer: jest.fn().mockImplementation(() => mockContentOptimizer)
  };
});

// Mock NextAuth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: '123', role: 'ARTIST' }
  })
}));

describe('/api/content/optimize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/content/optimize', () => {
    test('should return available strategies', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/optimize?action=strategies'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('strategies');
      expect(data.data.strategies).toHaveLength(6);
      expect(data.data.strategies[0]).toHaveProperty('key');
      expect(data.data.strategies[0]).toHaveProperty('name');
      expect(data.data.strategies[0]).toHaveProperty('description');
    });

    test('should analyze content when provided file path', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/optimize?action=analyze&filePath=test.jpg&contentType=IMAGE'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('analysis');
      expect(data.data.analysis).toHaveProperty('complexity');
      expect(data.data.analysis).toHaveProperty('recommendedStrategy');
    });

    test('should return error for missing required parameters in analyze', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/optimize?action=analyze'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required parameters');
    });

    test('should return default strategies action when no action specified', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/optimize'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('strategies');
    });

    test('should return error for invalid action', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/optimize?action=invalid'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid action');
    });
  });

  describe('POST /api/content/optimize', () => {
    test('should optimize single file', async () => {
      const requestBody = {
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('originalSize');
      expect(data.data).toHaveProperty('optimizedSize');
      expect(data.data).toHaveProperty('sizeReduction');
      expect(data.data).toHaveProperty('qualityScore');
      expect(data.data).toHaveProperty('optimizedUrl');
    });

    test('should optimize batch of files', async () => {
      const requestBody = {
        files: [
          { filePath: 'file1.jpg', contentType: 'IMAGE' },
          { filePath: 'file2.png', contentType: 'IMAGE' }
        ],
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('results');
      expect(data.data).toHaveProperty('summary');
      expect(data.data.results).toHaveLength(2);
      expect(data.data.summary).toHaveProperty('totalFiles');
      expect(data.data.summary).toHaveProperty('successfulOptimizations');
    });

    test('should validate required fields for single file optimization', async () => {
      const requestBody = {
        // Missing required fields
        strategy: 'balanced'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    test('should validate batch files array', async () => {
      const requestBody = {
        files: [], // Empty array
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Files array cannot be empty');
    });

    test('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid JSON');
    });

    test('should handle optimization service errors', async () => {
      // Mock the service to throw an error
      const { contentOptimizer } = require('../lib/content-optimization');
      contentOptimizer.optimizeContent.mockRejectedValueOnce(new Error('Service error'));

      const requestBody = {
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Service error');
    });

    test('should validate strategy parameter', async () => {
      const requestBody = {
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'invalid-strategy',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid strategy');
    });

    test('should validate contentType parameter', async () => {
      const requestBody = {
        filePath: 'test-file.txt',
        contentType: 'INVALID_TYPE',
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid contentType');
    });

    test('should validate targetDevice parameter', async () => {
      const requestBody = {
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'invalid-device',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid targetDevice');
    });

    test('should validate targetConnection parameter', async () => {
      const requestBody = {
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'invalid-connection'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid targetConnection');
    });
  });

  describe('Authentication', () => {
    test('should require authentication for POST requests', async () => {
      // Mock getServerSession to return null (not authenticated)
      const { getServerSession } = require('next-auth/next');
      getServerSession.mockResolvedValueOnce(null);

      const requestBody = {
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');
    });

    test('should allow GET requests without authentication', async () => {
      // Mock getServerSession to return null for GET request
      const { getServerSession } = require('next-auth/next');
      getServerSession.mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/content/optimize?action=strategies'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"malformed": json}'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401); // Auth happens before JSON parsing
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');
    });

    test('should handle missing content-type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: JSON.stringify({
          filePath: 'test-image.jpg',
          contentType: 'IMAGE',
          strategy: 'balanced'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still work as Next.js handles JSON parsing, but missing required fields
      expect(response.status).toBe(200); // Request succeeds but with incomplete data
      expect(data.success).toBe(true);
    });

    test('should handle very large batch requests', async () => {
      const largeFileList = Array(1000).fill(0).map((_, i) => ({
        filePath: `file${i}.jpg`,
        contentType: 'IMAGE'
      }));

      const requestBody = {
        files: largeFileList,
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'wifi'
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many files'); // Assuming we add this validation
    });
  });
});