/**
 * Error Handling & Edge Cases Test Suite
 * Tests error scenarios, invalid inputs, network failures, and edge cases
 */

import { NextRequest } from 'next/server';
import { POST as optimizeHandler } from '../app/api/content/optimize/route';
import { contentOptimizer } from '../lib/content-optimization';

// Define mock variables before jest.mock calls to avoid hoisting issues
const mockS3Send = jest.fn();
const mockUploadDone = jest.fn();

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

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn()
  })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn(() => ({
    done: jest.fn()
  }))
}));

// Mock content optimizer
const mockContentOptimizer = contentOptimizer as jest.Mocked<typeof contentOptimizer>;

describe('Error Handling & Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default success state
    mockSharp.metadata.mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg', size: 1048576 });
    mockSharp.toBuffer.mockResolvedValue(Buffer.from('optimized-image-data'));
    mockSharp.toFile.mockResolvedValue({ size: 50000 });
    mockSharp.stats.mockResolvedValue({ channels: 3, density: 72, hasProfile: false, hasAlpha: false, size: 1048576 });
    
    // Setup AWS mocks
    const { S3Client } = require('@aws-sdk/client-s3');
    const { Upload } = require('@aws-sdk/lib-storage');
    const mockS3Instance = new S3Client();
    const mockUploadInstance = new Upload({} as any);
    
    (mockS3Instance.send as jest.Mock).mockResolvedValue({
      Body: {
        transformToBuffer: jest.fn().mockResolvedValue(Buffer.from('file-content')),
      }
    });
    
    (mockUploadInstance.done as jest.Mock).mockResolvedValue({
      Location: 'https://mock-bucket.s3.amazonaws.com/optimized/test.webp'
    });
  });

  describe('Invalid Input Handling', () => {
    test('should handle missing file in form data', async () => {
      const formData = new FormData();
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('file');
    });

    test('should handle unsupported file types', async () => {
      const formData = new FormData();
      const unsupportedFile = new File(['text content'], 'document.txt', { type: 'text/plain' });
      formData.append('file', unsupportedFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unsupported.*file.*type/i);
    });

    test('should handle invalid strategy parameter', async () => {
      const formData = new FormData();
      const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'invalid-strategy');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid.*strategy/i);
    });

    test('should handle empty file', async () => {
      const formData = new FormData();
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
      formData.append('file', emptyFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/empty.*file/i);
    });

    test('should handle file too large', async () => {
      const formData = new FormData();
      // Create a mock large file (simulate 100MB)
      const largeContent = new Array(100 * 1024 * 1024).fill('x').join('');
      const largeFile = new File([largeContent], 'huge-image.jpg', { type: 'image/jpeg' });
      formData.append('file', largeFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(413);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/file.*too.*large/i);
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
      expect(result.error).toMatch(/invalid.*json/i);
    });
  });

  describe('Service Failure Handling', () => {
    test('should handle content optimization service failure', async () => {
      mockContentOptimizer.optimizeContent = jest.fn().mockRejectedValue(
        new Error('Content optimization service unavailable')
      );

      const formData = new FormData();
      const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('optimization');
    });

    test('should handle AWS S3 upload failure', async () => {
      mockUploadDone.mockRejectedValue(new Error('S3 service unavailable'));

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
          size: 262144,
          url: '/optimized/test.webp',
          optimizations: ['format_conversion']
        }]
      });

      const formData = new FormData();
      const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/upload.*failed|storage.*error/i);
    });

    test('should handle Sharp image processing failure', async () => {
      mockSharp.metadata.mockRejectedValue(new Error('Corrupted image file'));

      mockContentOptimizer.analyzeContent = jest.fn().mockRejectedValue(
        new Error('Image analysis failed: Corrupted image file')
      );

      const formData = new FormData();
      const mockFile = new File(['corrupted image data'], 'corrupted.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/analysis.*failed|corrupted/i);
    });

    test('should handle network timeout scenarios', async () => {
      // Simulate a timeout by making the optimization take too long
      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const formData = new FormData();
      const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
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
      mockSharp.metadata.mockResolvedValue({ width: 1, height: 1, format: 'jpeg', size: 100 });

      mockContentOptimizer.analyzeContent = jest.fn().mockResolvedValue({
        dimensions: { width: 1, height: 1 },
        complexity: 'low' as const,
        colorComplexity: 'monochrome' as const,
        noiseLevel: 'clean' as const,
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        recommendedStrategy: 'balanced'
      });

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

      const formData = new FormData();
      const tinyFile = new File(['tiny'], '1x1.jpg', { type: 'image/jpeg' });
      formData.append('file', tinyFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.originalSize).toBe(100);
    });

    test('should handle extremely large images', async () => {
      mockSharp.metadata.mockResolvedValue({ 
        width: 20000, 
        height: 20000, 
        format: 'jpeg', 
        size: 50 * 1024 * 1024 // 50MB
      });

      mockContentOptimizer.analyzeContent = jest.fn().mockResolvedValue({
        dimensions: { width: 20000, height: 20000 },
        complexity: 'high' as const,
        colorComplexity: 'full' as const,
        noiseLevel: 'moderate' as const,
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        recommendedStrategy: 'aggressive'
      });

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

      const formData = new FormData();
      const hugeFile = new File(['huge image'], 'huge.jpg', { type: 'image/jpeg' });
      formData.append('file', hugeFile);
      formData.append('strategy', 'auto');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.sizeReduction).toBeGreaterThanOrEqual(80); // Significant compression
    });

    test('should handle files with unusual aspect ratios', async () => {
      mockSharp.metadata.mockResolvedValue({ 
        width: 10000, 
        height: 100, 
        format: 'jpeg', 
        size: 1048576
      });

      mockContentOptimizer.analyzeContent = jest.fn().mockResolvedValue({
        dimensions: { width: 10000, height: 100 },
        complexity: 'medium' as const,
        colorComplexity: 'full' as const,
        noiseLevel: 'clean' as const,
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        recommendedStrategy: 'balanced'
      });

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

      const formData = new FormData();
      const panoramaFile = new File(['panorama'], 'panorama.jpg', { type: 'image/jpeg' });
      formData.append('file', panoramaFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
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

      const formData = new FormData();
      const specialNameFile = new File(['content'], 'tëst_fîle-#$%&@!.jpg', { type: 'image/jpeg' });
      formData.append('file', specialNameFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
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

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) => {
        const formData = new FormData();
        const mockFile = new File(['content'], `concurrent-${i}.jpg`, { type: 'image/jpeg' });
        formData.append('file', mockFile);
        formData.append('strategy', 'balanced');

        return new NextRequest('http://localhost:3000/api/content/optimize', {
          method: 'POST',
          body: formData
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
      // Mock some successes and some failures
      mockContentOptimizer.optimizeContent
        .mockResolvedValueOnce({
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: 1000,
          strategy: 'balanced',
          outputs: [{ quality: 'webp', format: 'webp', size: 524288, url: '/optimized/success1.webp', optimizations: [] }]
        })
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: 1000,
          strategy: 'balanced',
          outputs: [{ quality: 'webp', format: 'webp', size: 524288, url: '/optimized/success2.webp', optimizations: [] }]
        });

      const batchRequest = {
        files: [
          {
            path: 'https://test-bucket.s3.amazonaws.com/uploads/image1.jpg',
            type: 'IMAGE' as const,
            options: { strategy: 'balanced' }
          },
          {
            path: 'https://test-bucket.s3.amazonaws.com/uploads/image2.jpg',
            type: 'IMAGE' as const,
            options: { strategy: 'balanced' }
          },
          {
            path: 'https://test-bucket.s3.amazonaws.com/uploads/image3.jpg',
            type: 'IMAGE' as const,
            options: { strategy: 'balanced' }
          }
        ]
      };

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchRequest)
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2); // Only successful results
      expect(result.data.failures).toHaveLength(1); // Failed items tracked
    });
  });

  describe('Recovery and Retry Logic', () => {
    test('should attempt retry on transient failures', async () => {
      // Mock first call to fail, second to succeed
      mockContentOptimizer.optimizeContent
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: 2000, // Longer due to retry
          strategy: 'balanced',
          outputs: [{
            quality: 'webp',
            format: 'webp',
            size: 524288,
            url: '/optimized/retry-success.webp',
            optimizations: ['format_conversion']
          }]
        });

      const formData = new FormData();
      const mockFile = new File(['content'], 'retry-test.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(2); // Initial + retry
    });

    test('should fail permanently after max retries', async () => {
      // Mock all attempts to fail
      mockContentOptimizer.optimizeContent = jest.fn()
        .mockRejectedValue(new Error('Persistent service error'));

      const formData = new FormData();
      const mockFile = new File(['content'], 'permanent-fail.jpg', { type: 'image/jpeg' });
      formData.append('file', mockFile);
      formData.append('strategy', 'balanced');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
      // Should have attempted multiple times (depending on retry logic)
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});