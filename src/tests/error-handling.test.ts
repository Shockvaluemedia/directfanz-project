/**
 * Error Handling & Edge Cases Test Suite
 * Tests error scenarios, invalid inputs, network failures, and edge cases
 */

import { NextRequest } from 'next/server';
import { POST as optimizeHandler } from '../app/api/content/optimize/route';
import { contentOptimizer } from '../lib/content-optimization';

const mockSharp = {
  metadata: jest.fn(),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
  toFile: jest.fn(),
  stats: jest.fn()
};

// Mock dependencies
jest.mock('../lib/content-optimization');
jest.mock('../lib/media-processing');
jest.mock('sharp', () => jest.fn(() => mockSharp));

jest.mock('@/lib/s3', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://mock-s3.amazonaws.com/test-file', pathname: 'test-file' }),
  del: jest.fn().mockResolvedValue(undefined),
  head: jest.fn().mockResolvedValue({ url: 'https://mock-s3.amazonaws.com/test-file', size: 12345, uploadedAt: new Date() }),
  list: jest.fn().mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false }),
}));

// Mock next-auth to return an authenticated ARTIST session
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'artist-123', role: 'ARTIST', email: 'artist@test.com' }
  })
}));

// Mock content optimizer
const mockContentOptimizer = contentOptimizer as jest.Mocked<typeof contentOptimizer>;

// Helper to create a JSON POST request
function createJsonRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/content/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('Error Handling & Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-setup auth mock after clearAllMocks
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'artist-123', role: 'ARTIST', email: 'artist@test.com' }
    });

    // Reset mocks to default success state
    mockSharp.metadata.mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg', size: 1048576 });
    mockSharp.toBuffer.mockResolvedValue(Buffer.from('optimized-image-data'));
    mockSharp.toFile.mockResolvedValue({ size: 50000 });
    mockSharp.stats.mockResolvedValue({ channels: 3, density: 72, hasProfile: false, hasAlpha: false, size: 1048576 });

    // Setup Vercel Blob mocks
    const blob = require('@/lib/s3');
    (blob.put as jest.Mock).mockResolvedValue({ url: 'https://mock-s3.amazonaws.com/test-file', pathname: 'test-file' });
    (blob.del as jest.Mock).mockResolvedValue(undefined);
    (blob.head as jest.Mock).mockResolvedValue({ url: 'https://mock-s3.amazonaws.com/test-file', size: 12345, uploadedAt: new Date() });
    (blob.list as jest.Mock).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });
  });

  describe('Invalid Input Handling', () => {
    test('should handle missing required fields (filePath)', async () => {
      const request = createJsonRequest({
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    test('should handle invalid contentType', async () => {
      const request = createJsonRequest({
        filePath: 'test.txt',
        contentType: 'DOCUMENT',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid contentType/i);
    });

    test('should handle invalid strategy parameter', async () => {
      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'invalid-strategy'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid strategy/i);
    });

    test('should handle invalid targetDevice parameter', async () => {
      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'invalid-device'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid targetDevice/i);
    });

    test('should handle invalid targetConnection parameter', async () => {
      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'desktop',
        targetConnection: 'invalid-connection'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid targetConnection/i);
    });

    test('should handle empty batch files array', async () => {
      const request = createJsonRequest({
        files: [],
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Files array cannot be empty');
    });

    test('should handle malformed JSON in batch request', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{ invalid json }'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid JSON/i);
    });
  });

  describe('Service Failure Handling', () => {
    test('should handle content optimization service failure', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockRejectedValue(
        new Error('Content optimization service unavailable')
      );

      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('optimization');
    });

    test('should handle service error with details', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockRejectedValue(
        new Error('S3 service unavailable')
      );

      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('S3 service unavailable');
    });

    test('should handle analysis failure gracefully', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockRejectedValue(
        new Error('Content optimization failed: Corrupted image file')
      );

      const request = createJsonRequest({
        filePath: 'corrupted.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/failed|Corrupted/i);
    });

    test('should handle network timeout scenarios', async () => {
      // Simulate a timeout by making the optimization take too long
      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout/i);
    });
  });

  describe('Edge Cases', () => {
    test('should handle extremely small images', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockResolvedValue({
        originalSize: 100,
        optimizedSize: 80,
        sizeReduction: 20,
        qualityScore: 90,
        processingTime: 50,
        strategy: 'balanced',
        outputs: [{
          quality: 'webp',
          format: 'webp',
          size: 80,
          url: '/optimized/tiny.webp',
          optimizations: ['format_conversion']
        }]
      });

      const request = createJsonRequest({
        filePath: '1x1.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.originalSize).toBe(100);
    });

    test('should handle extremely large images', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockResolvedValue({
        originalSize: 50 * 1024 * 1024,
        optimizedSize: 5 * 1024 * 1024, // 90% reduction
        sizeReduction: 90,
        qualityScore: 75,
        processingTime: 30000, // 30 seconds
        strategy: 'aggressive',
        outputs: [{
          quality: 'webp',
          format: 'webp',
          size: 5 * 1024 * 1024,
          url: '/optimized/huge-compressed.webp',
          optimizations: ['aggressive_compression', 'format_conversion', 'downscaling']
        }]
      });

      const request = createJsonRequest({
        filePath: 'huge.jpg',
        contentType: 'IMAGE',
        strategy: 'auto'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.sizeReduction).toBeGreaterThanOrEqual(80); // Significant compression
    });

    test('should handle files with unusual aspect ratios', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockResolvedValue({
        originalSize: 1048576,
        optimizedSize: 524288,
        sizeReduction: 50,
        qualityScore: 90,
        processingTime: 1500,
        strategy: 'balanced',
        outputs: [{
          quality: 'webp',
          format: 'webp',
          size: 524288,
          url: '/optimized/panorama.webp',
          optimizations: ['format_conversion', 'strip_optimization']
        }]
      });

      const request = createJsonRequest({
        filePath: 'panorama.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    test('should handle files with special characters in names', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockResolvedValue({
        originalSize: 1048576,
        optimizedSize: 524288,
        sizeReduction: 50,
        qualityScore: 90,
        processingTime: 1500,
        strategy: 'balanced',
        outputs: [{
          quality: 'webp',
          format: 'webp',
          size: 524288,
          url: '/optimized/special-chars.webp',
          optimizations: ['format_conversion']
        }]
      });

      const request = createJsonRequest({
        filePath: 'test_file-special.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle high concurrent load gracefully', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockResolvedValue({
        originalSize: 1048576,
        optimizedSize: 524288,
        sizeReduction: 50,
        qualityScore: 90,
        processingTime: 1000,
        strategy: 'balanced',
        outputs: [{
          quality: 'webp',
          format: 'webp',
          size: 524288,
          url: '/optimized/concurrent.webp',
          optimizations: ['format_conversion']
        }]
      });

      // Create multiple concurrent requests using JSON body
      const requests = Array.from({ length: 10 }, (_, i) => {
        return createJsonRequest({
          filePath: `concurrent-${i}.jpg`,
          contentType: 'IMAGE',
          strategy: 'balanced'
        });
      });

      // Execute all requests concurrently
      const responses = await Promise.all(
        requests.map(request => optimizeHandler(request))
      );

      // All should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }

      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(10);
    });

    test('should handle partial failures in batch processing', async () => {
      // Mock batchOptimize to return only successful results
      mockContentOptimizer.batchOptimize = jest.fn().mockResolvedValue([
        {
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: 1000,
          strategy: 'balanced',
          outputs: [{ quality: 'webp', format: 'webp', size: 524288, url: '/optimized/success1.webp', optimizations: [] }]
        },
        {
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: 1000,
          strategy: 'balanced',
          outputs: [{ quality: 'webp', format: 'webp', size: 524288, url: '/optimized/success2.webp', optimizations: [] }]
        }
      ]);

      const batchRequest = {
        files: [
          {
            filePath: 'https://mock-s3.amazonaws.com/uploads/image1.jpg',
            contentType: 'IMAGE' as const,
          },
          {
            filePath: 'https://mock-s3.amazonaws.com/uploads/image2.jpg',
            contentType: 'IMAGE' as const,
          },
          {
            filePath: 'https://mock-s3.amazonaws.com/uploads/image3.jpg',
            contentType: 'IMAGE' as const,
          }
        ],
        strategy: 'balanced'
      };

      const request = createJsonRequest(batchRequest);

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2); // Only successful results
      expect(result.data.summary.failedOptimizations).toBe(1); // Failed items tracked in summary
    });
  });

  describe('Recovery and Error Propagation', () => {
    test('should propagate service errors correctly', async () => {
      mockContentOptimizer.optimizeContent = jest.fn()
        .mockRejectedValue(new Error('Temporary network error'));

      const request = createJsonRequest({
        filePath: 'retry-test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Temporary network error');
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(1);
    });

    test('should fail with persistent service error', async () => {
      // Mock all attempts to fail
      mockContentOptimizer.optimizeContent = jest.fn()
        .mockRejectedValue(new Error('Persistent service error'));

      const request = createJsonRequest({
        filePath: 'permanent-fail.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authentication', () => {
    test('should reject unauthenticated requests', async () => {
      const { getServerSession } = require('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    test('should reject non-artist users', async () => {
      const { getServerSession } = require('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'fan-123', role: 'FAN', email: 'fan@test.com' }
      });

      const request = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });
});
