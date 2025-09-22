import { ContentOptimizer } from '../lib/content-optimization';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';

// Import route handlers
import { GET as optimizeGET, POST as optimizePOST } from '../app/api/content/optimize/route';
import { POST as uploadPOST } from '../app/api/upload/presigned-url/route';
import { POST as contentPOST } from '../app/api/artist/content/route';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@prisma/client');
jest.mock('../lib/s3');
jest.mock('uuid');
jest.mock('fs/promises');
jest.mock('sharp');
jest.mock('fluent-ffmpeg');
jest.mock('ffprobe-static', () => ({
  path: '/fake/ffprobe/path'
}));
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');

// Mock AWS SDK
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

// Mock Prisma
const mockPrisma = {
  content: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

(PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma as any);

// Mock Sharp
const mockSharp = {
  metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg' }),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image-data')),
  toFile: jest.fn().mockResolvedValue({ size: 50000 }),
};

jest.mock('sharp', () => jest.fn(() => mockSharp));

// Mock FFmpeg
const mockFFmpeg = {
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
    return mockFFmpeg;
  }),
  run: jest.fn(),
};

jest.mock('fluent-ffmpeg', () => {
  const mockConstructor = jest.fn(() => mockFFmpeg);
  mockConstructor.setFfmpegPath = jest.fn();
  mockConstructor.setFfprobePath = jest.fn();
  return mockConstructor;
});

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-123') }));

// Mock getServerSession
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('Content Optimization Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockGetServerSession.mockResolvedValue({
      user: { id: 'artist-123', role: 'ARTIST', email: 'artist@example.com' }
    } as any);

    // Setup AWS SDK mocks
    const { S3Client } = require('@aws-sdk/client-s3');
    const { Upload } = require('@aws-sdk/lib-storage');
    const mockS3Instance = new S3Client();
    const mockUploadInstance = new Upload({} as any);
    
    (mockS3Instance.send as jest.Mock).mockResolvedValue({});
    (mockUploadInstance.done as jest.Mock).mockResolvedValue({
      Location: 'https://mock-s3-bucket.s3.amazonaws.com/uploads/mock-file.jpg'
    });

    (mockPrisma.content.create as jest.Mock).mockResolvedValue({
      id: 'content-123',
      title: 'Test Content',
      artistId: 'artist-123',
    });

    const fs = require('fs/promises');
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock-file-data'));
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Complete Upload-to-Publish Workflow', () => {
    test('should handle complete image optimization workflow', async () => {
      // Step 1: Get presigned URL for upload
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test-image.jpg',
          fileType: 'image/jpeg',
          fileSize: 100000
        })
      });

      const uploadResponse = await uploadPOST(uploadRequest);
      const uploadData = await uploadResponse.json();

      expect(uploadResponse.status).toBe(200);
      expect(uploadData.data).toHaveProperty('uploadUrl');
      expect(uploadData.data).toHaveProperty('fileUrl');

      // Step 2: Optimize the uploaded content
      const optimizeRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadData.data.fileUrl,
          contentType: 'IMAGE',
          strategy: 'balanced',
          targetDevice: 'mobile',
          targetConnection: '4g'
        })
      });

      const optimizeResponse = await optimizePOST(optimizeRequest);
      const optimizeData = await optimizeResponse.json();

      expect(optimizeResponse.status).toBe(200);
      expect(optimizeData.success).toBe(true);
      expect(optimizeData.data).toHaveProperty('optimizedUrl');
      expect(optimizeData.data).toHaveProperty('sizeReduction');
      expect(optimizeData.data).toHaveProperty('qualityScore');

      // Step 3: Create content entry
      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Image',
          description: 'Test image for integration testing',
          fileUrl: optimizeData.data.optimizedUrl,
          fileSize: 75000, // Smaller due to optimization
          format: 'jpg',
          tags: ['test', 'integration'],
          visibility: 'PUBLIC',
          optimization: {
            strategy: 'balanced',
            result: optimizeData.data
          }
        })
      });

      const contentResponse = await contentPOST(contentRequest);
      const contentData = await contentResponse.json();

      expect(contentResponse.status).toBe(200);
      expect(contentData.success).toBe(true);
      expect(mockPrisma.content.create).toHaveBeenCalledWith({
        title: 'Integration Test Image',
        description: 'Test image for integration testing',
        fileUrl: optimizeData.data.optimizedUrl,
        fileSize: 75000,
        format: 'jpg',
        tags: ['test', 'integration'],
        visibility: 'PUBLIC',
        artistId: 'artist-123',
        optimization: expect.objectContaining({
          strategy: 'balanced'
        })
      });
    });

    test('should handle complete video optimization workflow', async () => {
      // Step 1: Upload presigned URL for video
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test-video.mp4',
          fileType: 'video/mp4',
          fileSize: 5000000 // 5MB
        })
      });

      const uploadResponse = await uploadPOST(uploadRequest);
      const uploadData = await uploadResponse.json();

      expect(uploadResponse.status).toBe(200);

      // Step 2: Optimize video content
      const optimizeRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadData.data.fileUrl,
          contentType: 'VIDEO',
          strategy: 'streaming',
          targetDevice: 'tv',
          targetConnection: 'wifi'
        })
      });

      const optimizeResponse = await optimizePOST(optimizeRequest);
      const optimizeData = await optimizeResponse.json();

      expect(optimizeResponse.status).toBe(200);
      expect(optimizeData.success).toBe(true);
      expect(optimizeData.data.contentType).toBe('VIDEO');

      // Step 3: Create video content
      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Video',
          description: 'Test video for streaming optimization',
          fileUrl: optimizeData.data.optimizedUrl,
          fileSize: 3750000, // Reduced size
          format: 'mp4',
          tags: ['video', 'streaming', 'test'],
          visibility: 'TIER_LOCKED',
          tierIds: ['tier-premium'],
          optimization: {
            strategy: 'streaming',
            result: optimizeData.data
          }
        })
      });

      const contentResponse = await contentPOST(contentRequest);

      expect(contentResponse.status).toBe(200);
      expect(mockPrisma.content.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Integration Test Video',
          visibility: 'TIER_LOCKED'
        })
      );
    });

    test('should handle batch optimization workflow', async () => {
      // Step 1: Upload multiple files
      const files = [
        { fileName: 'image1.jpg', fileType: 'image/jpeg', fileSize: 80000 },
        { fileName: 'image2.png', fileType: 'image/png', fileSize: 120000 },
        { fileName: 'audio.mp3', fileType: 'audio/mp3', fileSize: 200000 }
      ];

      const uploadPromises = files.map(async file => {
        const request = new NextRequest('http://localhost:3000/api/upload/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(file)
        });
        const response = await uploadPOST(request);
        return response.json();
      });

      const uploadResults = await Promise.all(uploadPromises);

      expect(uploadResults).toHaveLength(3);
      uploadResults.forEach(result => {
        expect(result.data).toHaveProperty('uploadUrl');
        expect(result.data).toHaveProperty('fileUrl');
      });

      // Step 2: Batch optimize all files
      const batchOptimizeRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: true,
          files: uploadResults.map((result, index) => ({
            filePath: result.data.fileUrl,
            contentType: index < 2 ? 'IMAGE' : 'AUDIO',
            strategy: 'balanced',
            targetDevice: 'mobile',
            targetConnection: '4g'
          }))
        })
      });

      const batchOptimizeResponse = await optimizePOST(batchOptimizeRequest);
      const batchOptimizeData = await batchOptimizeResponse.json();

      expect(batchOptimizeResponse.status).toBe(200);
      expect(batchOptimizeData.success).toBe(true);
      expect(batchOptimizeData.data.results).toHaveLength(3);

      // Step 3: Create content entries for all optimized files
      const contentPromises = batchOptimizeData.data.results.map(async (result: any, index: number) => {
        const request = new NextRequest('http://localhost:3000/api/artist/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Batch Content ${index + 1}`,
            description: `Batch optimized content ${index + 1}`,
            fileUrl: result.optimizedUrl,
            fileSize: result.originalSize * (1 - result.sizeReduction / 100),
            format: files[index].fileName.split('.').pop(),
            tags: ['batch', 'test'],
            visibility: 'PUBLIC',
            optimization: {
              strategy: 'balanced',
              result: result
            }
          })
        });
        return contentPOST(request);
      });

      const contentResults = await Promise.all(contentPromises);

      contentResults.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockPrisma.content.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cross-Service Data Flow', () => {
    test('should preserve optimization metadata throughout the workflow', async () => {
      const optimizer = ContentOptimizer.getInstance();
      
      // Test optimization metadata preservation
      const mockAnalysis = {
        contentType: 'IMAGE',
        dimensions: { width: 1920, height: 1080 },
        fileSize: 100000,
        quality: 85,
        format: 'jpeg'
      };

      const mockResult = {
        optimizedUrl: 'https://mock-optimized-url.com/image.webp',
        originalSize: 100000,
        optimizedSize: 75000,
        sizeReduction: 25,
        qualityScore: 90,
        strategy: 'balanced',
        targetDevice: 'mobile',
        targetConnection: '4g',
        processingTime: 1500
      };

      // Mock the optimization process
      jest.spyOn(optimizer, 'analyzeContent').mockResolvedValue(mockAnalysis);
      jest.spyOn(optimizer, 'optimizeContent').mockResolvedValue(mockResult);

      // Step 1: Optimize content
      const optimizeRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'https://mock-upload-url.com/image.jpg',
          contentType: 'IMAGE',
          strategy: 'balanced',
          targetDevice: 'mobile',
          targetConnection: '4g'
        })
      });

      const optimizeResponse = await optimizePOST(optimizeRequest);
      const optimizeData = await optimizeResponse.json();

      expect(optimizeData.data).toMatchObject({
        sizeReduction: 25,
        qualityScore: 90,
        strategy: 'balanced',
        targetDevice: 'mobile',
        targetConnection: '4g'
      });

      // Step 2: Create content with optimization metadata
      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Metadata Preservation Test',
          fileUrl: optimizeData.data.optimizedUrl,
          fileSize: optimizeData.data.optimizedSize,
          optimization: {
            strategy: optimizeData.data.strategy,
            result: optimizeData.data,
            analysis: mockAnalysis
          }
        })
      });

      await contentPOST(contentRequest);

      expect(mockPrisma.content.create).toHaveBeenCalledWith(
        expect.objectContaining({
          optimization: expect.objectContaining({
            strategy: 'balanced',
            result: expect.objectContaining({
              sizeReduction: 25,
              qualityScore: 90,
              targetDevice: 'mobile'
            })
          })
        })
      );
    });

    test('should handle optimization failures gracefully in workflow', async () => {
      // Step 1: Successfully get upload URL
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'problematic.jpg',
          fileType: 'image/jpeg',
          fileSize: 100000
        })
      });

      const uploadResponse = await uploadPOST(uploadRequest);
      expect(uploadResponse.status).toBe(200);

      // Step 2: Optimization fails
      const optimizer = ContentOptimizer.getInstance();
      jest.spyOn(optimizer, 'optimizeContent').mockRejectedValue(new Error('Optimization failed'));

      const optimizeRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'https://mock-upload-url.com/problematic.jpg',
          contentType: 'IMAGE',
          strategy: 'balanced'
        })
      });

      const optimizeResponse = await optimizePOST(optimizeRequest);

      expect(optimizeResponse.status).toBe(500);

      // Step 3: Should still be able to create content with original file
      const uploadData = await uploadResponse.json();
      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Fallback Content',
          fileUrl: uploadData.data.fileUrl, // Use original file URL
          fileSize: 100000,
          format: 'jpg',
          optimization: null // No optimization applied
        })
      });

      const contentResponse = await contentPOST(contentRequest);
      expect(contentResponse.status).toBe(200);

      expect(mockPrisma.content.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Fallback Content',
          optimization: null
        })
      );
    });
  });

  describe('Authentication & Authorization Flow', () => {
    test('should enforce authentication across all endpoints', async () => {
      // Mock unauthenticated session
      mockGetServerSession.mockResolvedValue(null);

      // Test upload endpoint requires auth
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test.jpg',
          fileType: 'image/jpeg',
          fileSize: 100000
        })
      });

      const uploadResponse = await uploadPOST(uploadRequest);
      expect(uploadResponse.status).toBe(401);

      // Test optimize endpoint requires auth for non-strategy requests
      const optimizeRequest = new NextRequest('http://localhost:3000/api/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'https://mock-url.com/test.jpg',
          contentType: 'IMAGE',
          strategy: 'balanced'
        })
      });

      const optimizeResponse = await optimizePOST(optimizeRequest);
      expect(optimizeResponse.status).toBe(401);

      // Test content creation requires auth
      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Content',
          fileUrl: 'https://mock-url.com/test.jpg'
        })
      });

      const contentResponse = await contentPOST(contentRequest);
      expect(contentResponse.status).toBe(401);
    });

    test('should enforce artist role for content creation', async () => {
      // Mock fan user session
      mockGetServerSession.mockResolvedValue({
        user: { id: 'fan-123', role: 'FAN', email: 'fan@example.com' }
      } as any);

      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Unauthorized Content',
          fileUrl: 'https://mock-url.com/test.jpg'
        })
      });

      const contentResponse = await contentPOST(contentRequest);
      expect(contentResponse.status).toBe(403);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle S3 upload failures in workflow', async () => {
      // Mock S3 upload failure
      const { Upload } = require('@aws-sdk/lib-storage');
      const mockUploadInstance = new Upload({} as any);
      (mockUploadInstance.done as jest.Mock).mockRejectedValue(new Error('S3 upload failed'));

      const uploadRequest = new NextRequest('http://localhost:3000/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test.jpg',
          fileType: 'image/jpeg',
          fileSize: 100000
        })
      });

      const uploadResponse = await uploadPOST(uploadRequest);
      
      // Should handle error gracefully
      expect(uploadResponse.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle database failures in content creation', async () => {
      // Mock database failure
      (mockPrisma.content.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const contentRequest = new NextRequest('http://localhost:3000/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Content',
          fileUrl: 'https://mock-optimized-url.com/test.webp',
          fileSize: 75000,
          format: 'webp'
        })
      });

      const contentResponse = await contentPOST(contentRequest);
      expect(contentResponse.status).toBe(500);

      const errorData = await contentResponse.json();
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBeDefined();
    });
  });

  describe('Performance and Concurrent Operations', () => {
    test('should handle concurrent optimization requests', async () => {
      const optimizer = ContentOptimizer.getInstance();
      
      // Mock successful optimization
      jest.spyOn(optimizer, 'optimizeContent').mockResolvedValue({
        optimizedUrl: 'https://mock-optimized-url.com/concurrent.webp',
        originalSize: 100000,
        optimizedSize: 75000,
        sizeReduction: 25,
        qualityScore: 90,
        strategy: 'balanced',
        processingTime: 1000
      });

      // Create multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) => 
        new NextRequest('http://localhost:3000/api/content/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: `https://mock-url.com/concurrent-${i}.jpg`,
            contentType: 'IMAGE',
            strategy: 'balanced'
          })
        })
      );

      const responses = await Promise.all(
        requests.map(request => optimizePOST(request))
      );

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Optimization should be called for each request
      expect(optimizer.optimizeContent).toHaveBeenCalledTimes(5);
    });
  });
});