/**
 * Full Workflow Integration Tests
 * Tests the complete flow from file upload to optimization to content creation
 */

import { NextRequest } from 'next/server';
import { POST as optimizeHandler, GET as getStrategiesHandler } from '../app/api/content/optimize/route';
import { contentOptimizer } from '../lib/content-optimization';

const mockSharp = {
  metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg', size: 1048576 }),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image-data')),
  toFile: jest.fn().mockResolvedValue({ size: 50000 }),
  stats: jest.fn().mockResolvedValue({
    channels: 3,
    density: 72,
    hasProfile: false,
    hasAlpha: false,
    size: 1048576
  })
};

// Mock dependencies
jest.mock('../lib/content-optimization');
jest.mock('../lib/media-processing');
jest.mock('sharp', () => jest.fn(() => mockSharp));

jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://mock-blob.vercel-storage.com/test-file', pathname: 'test-file' }),
  del: jest.fn().mockResolvedValue(undefined),
  head: jest.fn().mockResolvedValue({ url: 'https://mock-blob.vercel-storage.com/test-file', size: 12345, uploadedAt: new Date() }),
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

describe('Full Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-setup auth mock after clearAllMocks
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'artist-123', role: 'ARTIST', email: 'artist@test.com' }
    });

    // Setup Vercel Blob mocks
    const blob = require('@vercel/blob');
    (blob.put as jest.Mock).mockResolvedValue({ url: 'https://mock-blob.vercel-storage.com/test-file', pathname: 'test-file' });
    (blob.del as jest.Mock).mockResolvedValue(undefined);
    (blob.head as jest.Mock).mockResolvedValue({ url: 'https://mock-blob.vercel-storage.com/test-file', size: 12345, uploadedAt: new Date() });
    (blob.list as jest.Mock).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

    mockContentOptimizer.analyzeContent = jest.fn();
    mockContentOptimizer.optimizeContent = jest.fn();
  });

  describe('End-to-End Upload and Optimization Workflow', () => {
    test('should handle complete image optimization workflow', async () => {
      // Mock analysis result
      const mockAnalysis = {
        dimensions: { width: 1920, height: 1080 },
        complexity: 'medium' as const,
        colorComplexity: 'full' as const,
        noiseLevel: 'clean' as const,
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        recommendedStrategy: 'balanced'
      };

      // Mock optimization result
      const mockOptimizationResult = {
        originalSize: 1048576,
        optimizedSize: 524288,
        sizeReduction: 50,
        qualityScore: 90,
        processingTime: 1500,
        strategy: 'balanced',
        outputs: [
          {
            quality: 'webp',
            format: 'webp',
            size: 262144,
            url: '/optimized/test.webp',
            optimizations: ['format_conversion', 'quality_adjustment']
          },
          {
            quality: 'jpeg',
            format: 'jpeg',
            size: 262144,
            url: '/optimized/test.jpg',
            optimizations: ['progressive_encoding', 'quality_adjustment']
          }
        ]
      };

      mockContentOptimizer.analyzeContent.mockResolvedValue(mockAnalysis);
      mockContentOptimizer.optimizeContent.mockResolvedValue(mockOptimizationResult);

      const request = createJsonRequest({
        filePath: 'test-image.jpg',
        contentType: 'IMAGE',
        strategy: 'balanced',
        targetDevice: 'mobile',
        targetConnection: '4g'
      });

      // Execute the full workflow
      const response = await optimizeHandler(request);
      const result = await response.json();

      // Verify the complete workflow
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        originalSize: 1048576,
        optimizedSize: 524288,
        sizeReduction: 50,
        qualityScore: 90,
        strategy: 'balanced',
        outputs: expect.arrayContaining([
          expect.objectContaining({
            format: 'webp',
            url: expect.stringContaining('optimized')
          }),
          expect.objectContaining({
            format: 'jpeg',
            url: expect.stringContaining('optimized')
          })
        ])
      });

      // Verify optimization was called with correct parameters
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledWith(
        'test-image.jpg',
        'IMAGE',
        expect.objectContaining({
          strategy: 'balanced',
          targetDevice: 'mobile',
          targetConnection: '4g'
        })
      );
    });

    test('should handle batch upload and optimization workflow', async () => {
      // Mock optimization results for multiple files
      const mockOptimizationResult = {
        originalSize: 1048576,
        optimizedSize: 524288,
        sizeReduction: 50,
        qualityScore: 90,
        processingTime: 1200,
        strategy: 'balanced',
        outputs: [
          {
            quality: 'webp',
            format: 'webp',
            size: 262144,
            url: '/optimized/batch-test.webp',
            optimizations: ['format_conversion']
          }
        ]
      };

      mockContentOptimizer.batchOptimize = jest.fn().mockResolvedValue([
        mockOptimizationResult,
        mockOptimizationResult,
        mockOptimizationResult
      ]);

      // Create batch optimization request
      const batchRequest = {
        files: [
          {
            filePath: 'https://test-bucket.s3.amazonaws.com/uploads/image1.jpg',
            contentType: 'IMAGE' as const,
          },
          {
            filePath: 'https://test-bucket.s3.amazonaws.com/uploads/image2.png',
            contentType: 'IMAGE' as const,
          },
          {
            filePath: 'https://test-bucket.s3.amazonaws.com/uploads/video1.mp4',
            contentType: 'VIDEO' as const,
          }
        ],
        strategy: 'balanced'
      };

      const request = createJsonRequest(batchRequest);

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('results');
      expect(Array.isArray(result.data.results)).toBe(true);
      expect(result.data.results).toHaveLength(3);

      // Verify batchOptimize was called
      expect(mockContentOptimizer.batchOptimize).toHaveBeenCalledTimes(1);
    });

    test('should integrate with strategy retrieval workflow', async () => {
      // Test GET endpoint for strategies - need to mock the dynamic import
      const { OPTIMIZATION_STRATEGIES } = require('../lib/content-optimization');

      const getRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'GET'
      });

      const strategiesResponse = await getStrategiesHandler(getRequest);
      const strategiesResult = await strategiesResponse.json();

      expect(strategiesResponse.status).toBe(200);
      expect(strategiesResult.success).toBe(true);
      expect(strategiesResult.data.strategies).toBeDefined();
      expect(Array.isArray(strategiesResult.data.strategies)).toBe(true);

      // Each strategy should have key, name, description
      for (const strategy of strategiesResult.data.strategies) {
        expect(strategy).toHaveProperty('key');
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('description');
      }

      // Now use one of these strategies in an optimization
      const mockOptimizationResult = {
        originalSize: 1048576,
        optimizedSize: 314573,
        sizeReduction: 70,
        qualityScore: 85,
        processingTime: 1800,
        strategy: 'aggressive',
        outputs: [
          {
            quality: 'webp',
            format: 'webp',
            size: 157287,
            url: '/optimized/aggressive-test.webp',
            optimizations: ['format_conversion', 'aggressive_compression']
          }
        ]
      };

      mockContentOptimizer.optimizeContent.mockResolvedValue(mockOptimizationResult);

      const optimizeRequest = createJsonRequest({
        filePath: 'test.jpg',
        contentType: 'IMAGE',
        strategy: 'aggressive'
      });

      const optimizeResponse = await optimizeHandler(optimizeRequest);
      const optimizeResult = await optimizeResponse.json();

      expect(optimizeResponse.status).toBe(200);
      expect(optimizeResult.data.strategy).toBe('aggressive');
      expect(optimizeResult.data.sizeReduction).toBe(70);
    });
  });

  describe('Cross-Service Integration', () => {
    test('should handle upload, analysis, optimization, and storage workflow', async () => {
      // Mock the complete pipeline
      const mockOptimization = {
        originalSize: 2097152, // 2MB
        optimizedSize: 1048576, // 1MB
        sizeReduction: 50,
        qualityScore: 95,
        processingTime: 2500,
        strategy: 'quality',
        outputs: [
          {
            quality: 'webp',
            format: 'webp',
            size: 524288,
            url: '/optimized/high-quality.webp',
            optimizations: ['format_conversion', 'lossless_optimization']
          },
          {
            quality: 'jpeg',
            format: 'jpeg',
            size: 524288,
            url: '/optimized/high-quality.jpg',
            optimizations: ['progressive_encoding', 'metadata_preservation']
          }
        ]
      };

      mockContentOptimizer.optimizeContent.mockResolvedValue(mockOptimization);

      const request = createJsonRequest({
        filePath: 'high-res-photo.jpg',
        contentType: 'IMAGE',
        strategy: 'quality',
        preserveMetadata: true,
        contentId: 'test-content-123'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      // Verify successful workflow completion
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Verify optimization was called with correct parameters
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledWith(
        'high-res-photo.jpg',
        'IMAGE',
        expect.objectContaining({
          strategy: 'quality',
          preserveMetadata: true,
          contentId: 'test-content-123',
          artistId: 'artist-123'
        })
      );

      // Verify high-quality output for complex image
      expect(result.data.qualityScore).toBeGreaterThanOrEqual(90);
      expect(result.data.outputs).toHaveLength(2);
      expect(result.data.outputs[0]).toMatchObject({
        format: 'webp',
        optimizations: expect.arrayContaining(['lossless_optimization'])
      });
    });

    test('should handle video processing workflow with thumbnails and streaming', async () => {
      const mockOptimization = {
        originalSize: 104857600, // 100MB
        optimizedSize: 52428800, // 50MB
        sizeReduction: 50,
        qualityScore: 88,
        processingTime: 45000, // 45 seconds
        strategy: 'streaming',
        outputs: [
          {
            quality: '1080p',
            format: 'mp4',
            size: 26214400,
            url: '/optimized/video-1080p.mp4',
            optimizations: ['h264_encoding', 'adaptive_bitrate']
          },
          {
            quality: '720p',
            format: 'mp4',
            size: 15728640,
            url: '/optimized/video-720p.mp4',
            optimizations: ['h264_encoding', 'mobile_optimization']
          },
          {
            quality: 'thumbnail',
            format: 'jpeg',
            size: 51200,
            url: '/optimized/video-thumb.jpg',
            optimizations: ['frame_extraction', 'thumbnail_generation']
          }
        ]
      };

      mockContentOptimizer.optimizeContent.mockResolvedValue(mockOptimization);

      const request = createJsonRequest({
        filePath: 'test-video.mp4',
        contentType: 'VIDEO',
        strategy: 'streaming',
        targetDevice: 'tv'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.strategy).toBe('streaming');
      expect(result.data.outputs).toHaveLength(3); // Multiple qualities + thumbnail
      expect(result.data.outputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ quality: '1080p' }),
          expect.objectContaining({ quality: '720p' }),
          expect.objectContaining({ quality: 'thumbnail' })
        ])
      );
    });
  });

  describe('Real-world Scenario Testing', () => {
    test('should handle content creator upload workflow', async () => {
      // Simulate a content creator uploading multiple files with different requirements
      const files = [
        { name: 'profile-pic.jpg', contentType: 'IMAGE', strategy: 'quality' },
        { name: 'cover-art.png', contentType: 'IMAGE', strategy: 'balanced' },
        { name: 'promo-video.mp4', contentType: 'VIDEO', strategy: 'streaming' },
        { name: 'audio-track.mp3', contentType: 'AUDIO', strategy: 'balanced' }
      ];

      const mockResults = files.map((file, index) => ({
        originalSize: 1048576 + (index * 524288),
        optimizedSize: 524288 + (index * 262144),
        sizeReduction: 50 - (index * 5),
        qualityScore: 90 + (index * 2),
        processingTime: 1000 + (index * 500),
        strategy: file.strategy,
        outputs: [
          {
            quality: 'optimized',
            format: file.name.split('.').pop(),
            size: 524288,
            url: `/optimized/${file.name}`,
            optimizations: ['format_optimization', 'size_reduction']
          }
        ]
      }));

      // Mock sequential optimization calls
      mockContentOptimizer.optimizeContent
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2])
        .mockResolvedValueOnce(mockResults[3]);

      // Test each file type
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const request = createJsonRequest({
          filePath: file.name,
          contentType: file.contentType,
          strategy: file.strategy
        });

        const response = await optimizeHandler(request);
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.data.strategy).toBe(file.strategy);
        expect(result.data.outputs[0].url).toContain(file.name);
      }

      // Verify all optimizations were called
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(files.length);
    });

    test('should handle mobile app upload with connectivity constraints', async () => {
      const mockOptimization = {
        originalSize: 3145728, // 3MB
        optimizedSize: 786432, // 768KB
        sizeReduction: 75, // Aggressive compression for mobile
        qualityScore: 78, // Lower quality for size savings
        processingTime: 3000,
        strategy: 'mobile',
        outputs: [
          {
            quality: 'mobile-optimized',
            format: 'webp',
            size: 393216,
            url: '/optimized/mobile-compressed.webp',
            optimizations: ['aggressive_compression', 'mobile_optimization', 'format_conversion']
          }
        ]
      };

      mockContentOptimizer.optimizeContent.mockResolvedValue(mockOptimization);

      const request = createJsonRequest({
        filePath: 'mobile-photo.jpg',
        contentType: 'IMAGE',
        strategy: 'mobile',
        targetDevice: 'mobile',
        targetConnection: '3g'
      });

      const response = await optimizeHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.sizeReduction).toBeGreaterThanOrEqual(70); // Significant compression
      expect(result.data.outputs[0].optimizations).toContain('mobile_optimization');
      expect(result.data.outputs[0].format).toBe('webp'); // Modern format for mobile
    });
  });
});
