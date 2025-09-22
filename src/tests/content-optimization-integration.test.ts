import { contentOptimizer } from '../lib/content-optimization';

// Mock dependencies
jest.mock('sharp');
jest.mock('fluent-ffmpeg', () => {
  const mockConstructor = jest.fn(() => ({
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    videoCodec: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    fps: jest.fn().mockReturnThis(),
    videoBitrate: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') {
        setTimeout(callback, 100);
      }
      return this;
    }),
    run: jest.fn(),
  }));
  mockConstructor.setFfmpegPath = jest.fn();
  mockConstructor.setFfprobePath = jest.fn();
  return mockConstructor;
});

jest.mock('ffprobe-static', () => ({
  path: '/fake/ffprobe/path'
}));

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

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn().mockResolvedValue({
    size: 1048576,
    isFile: () => true,
    isDirectory: () => false
  })
}));

jest.mock('fs', () => ({
  stat: jest.fn().mockImplementation((path, callback) => {
    callback(null, {
      size: 1048576,
      isFile: () => true,
      isDirectory: () => false
    });
  }),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn().mockResolvedValue({
      size: 1048576,
      isFile: () => true,
      isDirectory: () => false
    })
  }
}));

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-123') }));

// Mock Sharp
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

jest.mock('sharp', () => jest.fn(() => mockSharp));

describe('Content Optimization Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup fs mocks
    const fs = require('fs/promises');
    const fsSync = require('fs');
    
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock-file-data'));
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({
      size: 1048576,
      isFile: () => true,
      isDirectory: () => false
    });
    
    (fsSync.stat as jest.Mock).mockImplementation((path, callback) => {
      callback(null, {
        size: 1048576,
        isFile: () => true,
        isDirectory: () => false
      });
    });

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
      Location: 'https://mock-s3-bucket.s3.amazonaws.com/optimized/file.webp'
    });
  });

  describe('End-to-End Optimization Workflow', () => {
    test('should optimize an image file completely', async () => {
      const optimizer = contentOptimizer;

      // Step 1: Analyze content
      const analysis = await optimizer.analyzeContent(
        'https://mock-s3-bucket.s3.amazonaws.com/uploads/test.jpg',
        'IMAGE'
      );

      expect(analysis).toMatchObject({
        dimensions: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number)
        }),
        complexity: expect.any(String),
        colorComplexity: expect.any(String),
        recommendedStrategy: expect.any(String)
      });

      // Step 2: Optimize content
      const result = await optimizer.optimizeContent(
        'https://mock-s3-bucket.s3.amazonaws.com/uploads/test.jpg',
        'IMAGE',
        {
          strategy: 'balanced',
          targetDevice: 'mobile',
          targetConnection: '4g'
        }
      );

      expect(result).toMatchObject({
        originalSize: expect.any(Number),
        optimizedSize: expect.any(Number),
        sizeReduction: expect.any(Number),
        qualityScore: expect.any(Number),
        strategy: 'balanced',
        processingTime: expect.any(Number),
        outputs: expect.any(Array)
      });

      // Verify size reduction is reasonable
      expect(result.sizeReduction).toBeGreaterThan(0);
      expect(result.sizeReduction).toBeLessThan(100);
      expect(result.optimizedSize).toBeLessThan(result.originalSize);
    });

    test('should optimize a video file completely', async () => {
      const optimizer = contentOptimizer;

      const analysis = await optimizer.analyzeContent(
        'https://mock-s3-bucket.s3.amazonaws.com/uploads/video.mp4',
        'VIDEO'
      );

      expect(analysis).toMatchObject({
        dimensions: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number)
        }),
        complexity: expect.any(String),
        recommendedStrategy: expect.any(String)
      });

      const result = await optimizer.optimizeContent(
        'https://mock-s3-bucket.s3.amazonaws.com/uploads/video.mp4',
        'VIDEO',
        {
          strategy: 'streaming',
          targetDevice: 'tv',
          targetConnection: 'wifi'
        }
      );

      expect(result).toMatchObject({
        originalSize: expect.any(Number),
        optimizedSize: expect.any(Number),
        sizeReduction: expect.any(Number),
        qualityScore: expect.any(Number),
        strategy: 'streaming',
        outputs: expect.any(Array)
      });
    });

    test('should handle batch optimization efficiently', async () => {
      const optimizer = contentOptimizer;

      const files = [
        {
          url: 'https://mock-s3-bucket.s3.amazonaws.com/uploads/image1.jpg',
          type: 'IMAGE' as const,
          strategy: 'balanced' as const
        },
        {
          url: 'https://mock-s3-bucket.s3.amazonaws.com/uploads/image2.png',
          type: 'IMAGE' as const,
          strategy: 'quality' as const
        },
        {
          url: 'https://mock-s3-bucket.s3.amazonaws.com/uploads/audio.mp3',
          type: 'AUDIO' as const,
          strategy: 'size' as const
        }
      ];

      const results = await Promise.all(
        files.map(file => optimizer.optimizeContent(
          file.url,
          file.type,
          {
            strategy: file.strategy,
            targetDevice: 'mobile',
            targetConnection: '4g'
          }
        ))
      );

      expect(results).toHaveLength(3);

      // Verify each result has proper optimization
      results.forEach((result, index) => {
        expect(result).toMatchObject({
          strategy: expect.any(String), // Strategy might be auto-selected
          sizeReduction: expect.any(Number),
          qualityScore: expect.any(Number),
          outputs: expect.any(Array)
        });

        // Verify meaningful optimization occurred
        expect(result.sizeReduction).toBeGreaterThan(0);
        expect(result.optimizedSize).toBeLessThan(result.originalSize);
      });
    });

    test('should preserve metadata throughout optimization', async () => {
      const optimizer = contentOptimizer;

      const originalUrl = 'https://mock-s3-bucket.s3.amazonaws.com/uploads/metadata-test.jpg';
      const params = {
        strategy: 'balanced' as const,
        targetDevice: 'desktop' as const,
        targetConnection: 'wifi' as const
      };

      // Step 1: Analyze
      const analysis = await optimizer.analyzeContent(originalUrl, 'IMAGE');

      // Step 2: Optimize
      const result = await optimizer.optimizeContent(originalUrl, 'IMAGE', params);

      // Verify metadata is preserved and passed through
      expect(result.strategy).toBe(params.strategy);
      expect(result.outputs).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Verify optimization data is complete
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.outputs).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Quality score should be within reasonable bounds
      expect(result.qualityScore).toBeGreaterThanOrEqual(60);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    test('should handle optimization failures gracefully', async () => {
      const optimizer = contentOptimizer;

      // Mock Sharp to throw an error during analysis
      mockSharp.metadata.mockRejectedValueOnce(new Error('Processing failed'));

      await expect(
        optimizer.optimizeContent(
          'https://mock-s3-bucket.s3.amazonaws.com/uploads/corrupted.jpg',
          'IMAGE',
          { strategy: 'balanced' }
        )
      ).rejects.toThrow('Content optimization failed');
    });

    test('should validate optimization strategies work correctly', async () => {
      const optimizer = contentOptimizer;
      const baseUrl = 'https://mock-s3-bucket.s3.amazonaws.com/uploads/test.jpg';

      const strategies = ['auto', 'balanced', 'quality', 'size', 'mobile'] as const;

      for (const strategy of strategies) {
        const result = await optimizer.optimizeContent(baseUrl, 'IMAGE', { strategy });

        expect(result.strategy).toBeDefined();
        expect(result.sizeReduction).toBeGreaterThan(0);
        
        // Different strategies should produce different optimization characteristics
        if (strategy === 'quality') {
          expect(result.qualityScore).toBeGreaterThanOrEqual(85);
        } else if (strategy === 'size') {
          expect(result.sizeReduction).toBeGreaterThanOrEqual(30);
        }
      }
    });

    test('should handle different target devices appropriately', async () => {
      const optimizer = contentOptimizer;
      const baseUrl = 'https://mock-s3-bucket.s3.amazonaws.com/uploads/responsive.jpg';

      const devices = ['mobile', 'tablet', 'desktop', 'tv'] as const;

      const results = await Promise.all(
        devices.map(device => 
          optimizer.optimizeContent(baseUrl, 'IMAGE', {
            strategy: 'auto',
            targetDevice: device,
            targetConnection: 'wifi'
          })
        )
      );

      // Each result should be properly optimized
      results.forEach((result, index) => {
        expect(result.outputs).toBeDefined();
        expect(result.sizeReduction).toBeGreaterThan(0);
      });

      // Mobile should generally have higher compression than desktop
      const mobileResult = results[0]; // mobile device result
      const desktopResult = results[2]; // desktop device result

      // Mobile optimization should typically result in smaller file size
      expect(mobileResult.optimizedSize).toBeLessThanOrEqual(desktopResult.optimizedSize);
    });

    test('should handle different connection types appropriately', async () => {
      const optimizer = contentOptimizer;
      const baseUrl = 'https://mock-s3-bucket.s3.amazonaws.com/uploads/connection-test.jpg';

      const connections = ['2g', '3g', '4g', '5g', 'wifi'] as const;

      const results = await Promise.all(
        connections.map(connection => 
          optimizer.optimizeContent(baseUrl, 'IMAGE', {
            strategy: 'auto',
            targetDevice: 'mobile',
            targetConnection: connection
          })
        )
      );

      // Each result should be properly optimized
      results.forEach((result, index) => {
        expect(result.outputs).toBeDefined();
        expect(result.sizeReduction).toBeGreaterThan(0);
      });

      // 2G should have highest compression, WiFi should have lowest
      const result2g = results[0]; // 2g connection result
      const resultWifi = results[4]; // wifi connection result

      expect(result2g.sizeReduction).toBeGreaterThanOrEqual(resultWifi.sizeReduction);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent optimizations efficiently', async () => {
      const optimizer = contentOptimizer;

      const concurrentTasks = Array.from({ length: 5 }, (_, i) =>
        optimizer.optimizeContent(
          `https://mock-s3-bucket.s3.amazonaws.com/uploads/concurrent-${i}.jpg`,
          'IMAGE',
          { strategy: 'balanced' }
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentTasks);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.outputs).toBeDefined();
        expect(result.sizeReduction).toBeGreaterThan(0);
      });

      // Should complete reasonably quickly (less than 10 seconds for mocked operations)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    test('should maintain consistent quality across optimization runs', async () => {
      const optimizer = contentOptimizer;
      const baseUrl = 'https://mock-s3-bucket.s3.amazonaws.com/uploads/consistency.jpg';
      const params = { strategy: 'balanced' as const };

      // Run the same optimization multiple times
      const runs = await Promise.all([
        optimizer.optimizeContent(baseUrl, 'IMAGE', params),
        optimizer.optimizeContent(baseUrl, 'IMAGE', params),
        optimizer.optimizeContent(baseUrl, 'IMAGE', params)
      ]);

      // Results should be consistent
      const firstResult = runs[0];
      runs.forEach(result => {
        expect(result.strategy).toBe(firstResult.strategy);
        expect(result.sizeReduction).toBeCloseTo(firstResult.sizeReduction, 1);
        expect(result.qualityScore).toBeCloseTo(firstResult.qualityScore, 1);
      });
    });
  });
});