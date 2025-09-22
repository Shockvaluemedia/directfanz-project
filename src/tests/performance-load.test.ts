/**
 * Performance & Load Testing Suite
 * Tests system performance with large files, concurrent optimizations, and various strategies
 */

import { NextRequest } from 'next/server';
import { POST as optimizeHandler } from '../app/api/content/optimize/route';
import { contentOptimizer } from '../lib/content-optimization';

// Define mock variables before jest.mock calls to avoid hoisting issues
const mockS3Send = jest.fn();
const mockUploadDone = jest.fn();

const mockSharp = {
  metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg', size: 1048576 }),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image-data')),
  toFile: jest.fn().mockResolvedValue({ size: 50000 }),
  stats: jest.fn().mockResolvedValue({ channels: 3, density: 72, hasProfile: false, hasAlpha: false, size: 1048576 })
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

describe('Performance & Load Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
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

  describe('Large File Processing', () => {
    test('should handle very large image files efficiently', async () => {
      // Simulate a 50MB image
      const largeImageSize = 50 * 1024 * 1024;
      
      mockSharp.metadata.mockResolvedValue({ 
        width: 8000, 
        height: 6000, 
        format: 'jpeg', 
        size: largeImageSize 
      });

      mockContentOptimizer.analyzeContent = jest.fn().mockResolvedValue({
        dimensions: { width: 8000, height: 6000 },
        complexity: 'high' as const,
        colorComplexity: 'full' as const,
        noiseLevel: 'moderate' as const,
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        recommendedStrategy: 'aggressive'
      });

      const startTime = Date.now();
      
      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        // Simulate processing time for large file
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          originalSize: largeImageSize,
          optimizedSize: 5 * 1024 * 1024, // 90% reduction
          sizeReduction: 90,
          qualityScore: 80,
          processingTime: Date.now() - startTime,
          strategy: 'aggressive',
          outputs: [{
            quality: 'webp',
            format: 'webp',
            size: 5 * 1024 * 1024,
            url: '/optimized/large-compressed.webp',
            optimizations: ['aggressive_compression', 'downscaling', 'format_conversion']
          }]
        };
      });

      const formData = new FormData();
      const largeFile = new File(['large image content'], 'large-image.jpg', { type: 'image/jpeg' });
      formData.append('file', largeFile);
      formData.append('strategy', 'auto');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const response = await optimizeHandler(request);
      const result = await response.json();
      const totalTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.sizeReduction).toBeGreaterThanOrEqual(80);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle multiple large files concurrently', async () => {
      const largeFileSize = 20 * 1024 * 1024; // 20MB each
      const fileCount = 5;

      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        // Simulate concurrent processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
        return {
          originalSize: largeFileSize,
          optimizedSize: largeFileSize * 0.4, // 60% reduction
          sizeReduction: 60,
          qualityScore: 85,
          processingTime: Math.random() * 2000 + 1000,
          strategy: 'balanced',
          outputs: [{
            quality: 'webp',
            format: 'webp',
            size: largeFileSize * 0.4,
            url: '/optimized/concurrent-large.webp',
            optimizations: ['format_conversion', 'compression']
          }]
        };
      });

      const requests = Array.from({ length: fileCount }, (_, i) => {
        const formData = new FormData();
        const file = new File(['large content'], `large-${i}.jpg`, { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('strategy', 'balanced');

        return new NextRequest('http://localhost:3000/api/content/optimize', {
          method: 'POST',
          body: formData
        });
      });

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => optimizeHandler(request))
      );
      const totalTime = Date.now() - startTime;

      // All should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data.sizeReduction).toBeGreaterThan(50);
      }

      // Should be processed concurrently (faster than sequential)
      expect(totalTime).toBeLessThan(fileCount * 2000); // Much faster than sequential
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(fileCount);
    });

    test('should handle video files with long processing times', async () => {
      const videoSize = 100 * 1024 * 1024; // 100MB video
      
      mockContentOptimizer.analyzeContent = jest.fn().mockResolvedValue({
        dimensions: { width: 1920, height: 1080 },
        complexity: 'high' as const,
        colorComplexity: 'full' as const,
        noiseLevel: 'moderate' as const,
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        duration: 300, // 5 minutes
        bitrate: 5000000,
        recommendedStrategy: 'streaming'
      });

      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        // Simulate long video processing
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          originalSize: videoSize,
          optimizedSize: 40 * 1024 * 1024, // 60% reduction
          sizeReduction: 60,
          qualityScore: 88,
          processingTime: 45000, // 45 seconds
          strategy: 'streaming',
          outputs: [
            {
              quality: '1080p',
              format: 'mp4',
              size: 20 * 1024 * 1024,
              url: '/optimized/video-1080p.mp4',
              optimizations: ['h264_encoding', 'adaptive_bitrate']
            },
            {
              quality: '720p',
              format: 'mp4',
              size: 15 * 1024 * 1024,
              url: '/optimized/video-720p.mp4',
              optimizations: ['h264_encoding', 'mobile_optimization']
            },
            {
              quality: '480p',
              format: 'mp4',
              size: 8 * 1024 * 1024,
              url: '/optimized/video-480p.mp4',
              optimizations: ['h264_encoding', 'low_bandwidth_optimization']
            }
          ]
        };
      });

      const formData = new FormData();
      const videoFile = new File(['video content'], 'long-video.mp4', { type: 'video/mp4' });
      formData.append('file', videoFile);
      formData.append('strategy', 'streaming');

      const request = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        body: formData
      });

      const startTime = Date.now();
      const response = await optimizeHandler(request);
      const result = await response.json();
      const totalTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.outputs).toHaveLength(3); // Multiple quality outputs
      expect(result.data.sizeReduction).toBeGreaterThan(50);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds (mocked)
    });
  });

  describe('High Concurrency Testing', () => {
    test('should handle 20 concurrent image optimizations', async () => {
      const concurrentCount = 20;

      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        // Simulate varying processing times
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
        return {
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: Math.random() * 1500 + 500,
          strategy: 'balanced',
          outputs: [{
            quality: 'webp',
            format: 'webp',
            size: 524288,
            url: '/optimized/concurrent.webp',
            optimizations: ['format_conversion']
          }]
        };
      });

      const requests = Array.from({ length: concurrentCount }, (_, i) => {
        const formData = new FormData();
        const file = new File(['content'], `concurrent-${i}.jpg`, { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('strategy', 'balanced');

        return new NextRequest('http://localhost:3000/api/content/optimize', {
          method: 'POST',
          body: formData
        });
      });

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => optimizeHandler(request))
      );
      const totalTime = Date.now() - startTime;

      // All should succeed
      let successCount = 0;
      for (const response of responses) {
        const result = await response.json();
        if (result.success) {
          successCount++;
        }
        expect(response.status).toBe(200);
      }

      expect(successCount).toBe(concurrentCount);
      expect(totalTime).toBeLessThan(5000); // Should handle concurrency efficiently
      expect(mockContentOptimizer.optimizeContent).toHaveBeenCalledTimes(concurrentCount);
    });

    test('should handle mixed content types under load', async () => {
      const contentTypes = [
        { name: 'image1.jpg', type: 'image/jpeg', contentType: 'IMAGE' },
        { name: 'image2.png', type: 'image/png', contentType: 'IMAGE' },
        { name: 'video1.mp4', type: 'video/mp4', contentType: 'VIDEO' },
        { name: 'audio1.mp3', type: 'audio/mpeg', contentType: 'AUDIO' },
        { name: 'image3.webp', type: 'image/webp', contentType: 'IMAGE' },
      ];

      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
        return {
          originalSize: 2097152,
          optimizedSize: 1048576,
          sizeReduction: 50,
          qualityScore: 88,
          processingTime: Math.random() * 2000 + 500,
          strategy: 'balanced',
          outputs: [{
            quality: 'optimized',
            format: 'webp',
            size: 1048576,
            url: '/optimized/mixed-content.webp',
            optimizations: ['format_conversion', 'compression']
          }]
        };
      });

      // Create multiple instances of each content type
      const requests = [];
      for (let i = 0; i < 4; i++) {
        for (const content of contentTypes) {
          const formData = new FormData();
          const file = new File(['content'], `${i}-${content.name}`, { type: content.type });
          formData.append('file', file);
          formData.append('strategy', 'auto');

          requests.push(new NextRequest('http://localhost:3000/api/content/optimize', {
            method: 'POST',
            body: formData
          }));
        }
      }

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => optimizeHandler(request))
      );
      const totalTime = Date.now() - startTime;

      // Verify all succeeded
      for (const response of responses) {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }

      expect(responses).toHaveLength(20); // 4 * 5 content types
      expect(totalTime).toBeLessThan(8000); // Should handle mixed load efficiently
    });

    test('should maintain performance under sustained load', async () => {
      // Simulate sustained load over multiple waves
      const wavesCount = 3;
      const requestsPerWave = 10;

      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 75));
        return {
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: Math.random() * 1000 + 500,
          strategy: 'balanced',
          outputs: [{
            quality: 'webp',
            format: 'webp',
            size: 524288,
            url: '/optimized/sustained.webp',
            optimizations: ['format_conversion']
          }]
        };
      });

      const waveTimes: number[] = [];

      for (let wave = 0; wave < wavesCount; wave++) {
        const requests = Array.from({ length: requestsPerWave }, (_, i) => {
          const formData = new FormData();
          const file = new File(['content'], `wave-${wave}-file-${i}.jpg`, { type: 'image/jpeg' });
          formData.append('file', file);
          formData.append('strategy', 'balanced');

          return new NextRequest('http://localhost:3000/api/content/optimize', {
            method: 'POST',
            body: formData
          });
        });

        const waveStartTime = Date.now();
        const responses = await Promise.all(
          requests.map(request => optimizeHandler(request))
        );
        const waveTime = Date.now() - waveStartTime;
        waveTimes.push(waveTime);

        // Verify all succeeded in this wave
        for (const response of responses) {
          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);
        }

        // Small delay between waves
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Performance should not degrade significantly across waves
      const avgTime = waveTimes.reduce((sum, time) => sum + time, 0) / waveTimes.length;
      const maxTime = Math.max(...waveTimes);
      const minTime = Math.min(...waveTimes);

      expect(maxTime - minTime).toBeLessThan(avgTime * 0.5); // Variation should be < 50% of average
      expect(maxTime).toBeLessThan(3000); // No wave should take more than 3 seconds
    });
  });

  describe('Memory and Resource Management', () => {
    test('should handle optimization strategies efficiently', async () => {
      const strategies = ['aggressive', 'balanced', 'quality', 'mobile', 'streaming'];
      const resultsPerStrategy = 5;

      const strategyTimes: Record<string, number[]> = {};

      for (const strategy of strategies) {
        strategyTimes[strategy] = [];

        mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
          // Different strategies have different processing characteristics
          let delay = 100;
          let sizeReduction = 50;
          let qualityScore = 90;

          switch (strategy) {
            case 'aggressive':
              delay = 150; // More processing for aggressive compression
              sizeReduction = 75;
              qualityScore = 75;
              break;
            case 'quality':
              delay = 200; // More processing for quality preservation
              sizeReduction = 25;
              qualityScore = 98;
              break;
            case 'mobile':
              delay = 120;
              sizeReduction = 65;
              qualityScore = 80;
              break;
            case 'streaming':
              delay = 300; // Longest for video processing
              sizeReduction = 55;
              qualityScore = 85;
              break;
            default: // balanced
              delay = 100;
              sizeReduction = 50;
              qualityScore = 90;
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          return {
            originalSize: 1048576,
            optimizedSize: Math.floor(1048576 * (100 - sizeReduction) / 100),
            sizeReduction,
            qualityScore,
            processingTime: delay,
            strategy,
            outputs: [{
              quality: 'optimized',
              format: 'webp',
              size: Math.floor(1048576 * (100 - sizeReduction) / 100),
              url: `/optimized/${strategy}.webp`,
              optimizations: [`${strategy}_optimization`]
            }]
          };
        });

        const requests = Array.from({ length: resultsPerStrategy }, (_, i) => {
          const formData = new FormData();
          const file = new File(['content'], `${strategy}-${i}.jpg`, { type: 'image/jpeg' });
          formData.append('file', file);
          formData.append('strategy', strategy);

          return new NextRequest('http://localhost:3000/api/content/optimize', {
            method: 'POST',
            body: formData
          });
        });

        const strategyStartTime = Date.now();
        const responses = await Promise.all(
          requests.map(request => optimizeHandler(request))
        );
        const strategyTime = Date.now() - strategyStartTime;
        strategyTimes[strategy].push(strategyTime);

        // Verify all succeeded
        for (const response of responses) {
          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);
          expect(result.data.strategy).toBe(strategy);
        }
      }

      // Verify strategies perform within expected ranges
      expect(strategyTimes['aggressive'][0]).toBeLessThan(2000);
      expect(strategyTimes['quality'][0]).toBeLessThan(2500);
      expect(strategyTimes['streaming'][0]).toBeLessThan(3000);
      expect(strategyTimes['balanced'][0]).toBeLessThan(1500);
      expect(strategyTimes['mobile'][0]).toBeLessThan(1800);
    });

    test('should handle batch processing efficiently', async () => {
      const batchSizes = [5, 10, 15, 20];
      const batchTimes: number[] = [];

      for (const batchSize of batchSizes) {
        mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            originalSize: 1048576,
            optimizedSize: 524288,
            sizeReduction: 50,
            qualityScore: 90,
            processingTime: 100,
            strategy: 'balanced',
            outputs: [{
              quality: 'webp',
              format: 'webp',
              size: 524288,
              url: '/optimized/batch.webp',
              optimizations: ['format_conversion']
            }]
          };
        });

        const batchRequest = {
          files: Array.from({ length: batchSize }, (_, i) => ({
            path: `https://test-bucket.s3.amazonaws.com/uploads/batch-${i}.jpg`,
            type: 'IMAGE' as const,
            options: { strategy: 'balanced' }
          }))
        };

        const request = new NextRequest('http://localhost:3000/api/content/optimize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(batchRequest)
        });

        const batchStartTime = Date.now();
        const response = await optimizeHandler(request);
        const result = await response.json();
        const batchTime = Date.now() - batchStartTime;
        batchTimes.push(batchTime);

        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.data.results).toHaveLength(batchSize);
      }

      // Batch processing should scale reasonably (not linearly due to concurrency)
      const timePerItem = batchTimes.map((time, i) => time / batchSizes[i]);
      const avgTimePerItem = timePerItem.reduce((sum, time) => sum + time, 0) / timePerItem.length;

      // Each item should be processed efficiently even in large batches
      expect(avgTimePerItem).toBeLessThan(200); // Average time per item should be reasonable
    });
  });

  describe('Stress Testing', () => {
    test('should survive extreme concurrent load', async () => {
      const extremeCount = 50;

      mockContentOptimizer.optimizeContent = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        return {
          originalSize: 1048576,
          optimizedSize: 524288,
          sizeReduction: 50,
          qualityScore: 90,
          processingTime: Math.random() * 500 + 250,
          strategy: 'balanced',
          outputs: [{
            quality: 'webp',
            format: 'webp',
            size: 524288,
            url: '/optimized/extreme.webp',
            optimizations: ['format_conversion']
          }]
        };
      });

      const requests = Array.from({ length: extremeCount }, (_, i) => {
        const formData = new FormData();
        const file = new File(['content'], `extreme-${i}.jpg`, { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('strategy', 'balanced');

        return new NextRequest('http://localhost:3000/api/content/optimize', {
          method: 'POST',
          body: formData
        });
      });

      const startTime = Date.now();
      
      // Use Promise.allSettled to handle any potential failures gracefully
      const results = await Promise.allSettled(
        requests.map(request => optimizeHandler(request))
      );
      
      const totalTime = Date.now() - startTime;

      // Count successes and failures
      const successes = results.filter(result => result.status === 'fulfilled').length;
      const failures = results.filter(result => result.status === 'rejected').length;

      // Should handle most requests successfully
      expect(successes).toBeGreaterThanOrEqual(extremeCount * 0.9); // At least 90% success rate
      expect(failures).toBeLessThanOrEqual(extremeCount * 0.1); // At most 10% failure rate
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });
});