import { describe, it, beforeAll, afterAll } from '@jest/globals';
import {
  generatePresignedUrl,
  validateFileUpload,
  extractKeyFromUrl,
  SUPPORTED_FILE_TYPES,
  FILE_SIZE_LIMITS,
} from '../s3';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com'),
}));

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'mock-access-key',
    AWS_SECRET_ACCESS_KEY: 'mock-secret-key',
    AWS_S3_BUCKET_NAME: 'mock-bucket',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('S3 Utils', () => {
  describe('validateFileUpload', () => {
    it('should validate supported file types', () => {
      const errors = validateFileUpload('test.mp3', 'audio/mpeg', 1024);
      expect(errors).toHaveLength(0);
    });

    it('should reject unsupported file types', () => {
      const errors = validateFileUpload('test.exe', 'application/exe', 1024);
      expect(errors).toContain('Unsupported file type: application/exe');
    });

    it('should reject files that exceed size limits', () => {
      const largeSize = FILE_SIZE_LIMITS.AUDIO + 1;
      const errors = validateFileUpload('test.mp3', 'audio/mpeg', largeSize);
      expect(errors).toContain('File size exceeds limit of 100MB for AUDIO files');
    });

    it('should reject empty file names', () => {
      const errors = validateFileUpload('', 'audio/mpeg', 1024);
      expect(errors).toContain('File name is required');
    });

    it('should reject zero or negative file sizes', () => {
      const errors = validateFileUpload('test.mp3', 'audio/mpeg', 0);
      expect(errors).toContain('File size must be greater than 0');
    });

    it('should validate multiple errors at once', () => {
      const errors = validateFileUpload('', 'application/exe', 0);
      expect(errors).toHaveLength(3);
      expect(errors).toContain('File name is required');
      expect(errors).toContain('Unsupported file type: application/exe');
      expect(errors).toContain('File size must be greater than 0');
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate presigned URL for valid file', async () => {
      const result = await generatePresignedUrl({
        fileName: 'test.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
        artistId: 'artist-123',
      });

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('fileUrl');
      expect(result).toHaveProperty('key');
      expect(result.uploadUrl).toBe('https://mock-presigned-url.com');
      expect(result.key).toContain('content/artist-123/');
      expect(result.key).toContain('test.mp3');
    });

    it('should throw error for unsupported file type', async () => {
      await expect(
        generatePresignedUrl({
          fileName: 'test.exe',
          fileType: 'application/exe',
          fileSize: 1024,
          artistId: 'artist-123',
        })
      ).rejects.toThrow('Unsupported file type: application/exe');
    });

    it('should throw error for oversized file', async () => {
      const largeSize = FILE_SIZE_LIMITS.AUDIO + 1;
      await expect(
        generatePresignedUrl({
          fileName: 'test.mp3',
          fileType: 'audio/mpeg',
          fileSize: largeSize,
          artistId: 'artist-123',
        })
      ).rejects.toThrow('File size exceeds limit of 100MB for AUDIO files');
    });
  });

  describe('extractKeyFromUrl', () => {
    it('should extract key from S3 URL', () => {
      // Set the bucket name in environment for this test
      process.env.AWS_S3_BUCKET_NAME = 'mock-bucket';
      const url = 'https://mock-bucket.s3.us-east-1.amazonaws.com/content/artist-123/file.mp3';
      const key = extractKeyFromUrl(url);
      expect(key).toBe('content/artist-123/file.mp3');
    });

    it('should throw error for invalid URL', () => {
      const url = 'https://invalid-url.com/file.mp3';
      expect(() => extractKeyFromUrl(url)).toThrow('Invalid S3 URL');
    });
  });

  describe('SUPPORTED_FILE_TYPES', () => {
    it('should include all expected audio types', () => {
      expect(SUPPORTED_FILE_TYPES['audio/mpeg']).toEqual({
        extension: 'mp3',
        category: 'AUDIO',
      });
      expect(SUPPORTED_FILE_TYPES['audio/wav']).toEqual({
        extension: 'wav',
        category: 'AUDIO',
      });
    });

    it('should include all expected video types', () => {
      expect(SUPPORTED_FILE_TYPES['video/mp4']).toEqual({
        extension: 'mp4',
        category: 'VIDEO',
      });
    });

    it('should include all expected image types', () => {
      expect(SUPPORTED_FILE_TYPES['image/jpeg']).toEqual({
        extension: 'jpg',
        category: 'IMAGE',
      });
    });

    it('should include all expected document types', () => {
      expect(SUPPORTED_FILE_TYPES['application/pdf']).toEqual({
        extension: 'pdf',
        category: 'DOCUMENT',
      });
    });
  });

  describe('FILE_SIZE_LIMITS', () => {
    it('should have appropriate size limits for each category', () => {
      expect(FILE_SIZE_LIMITS.AUDIO).toBe(100 * 1024 * 1024); // 100MB
      expect(FILE_SIZE_LIMITS.VIDEO).toBe(500 * 1024 * 1024); // 500MB
      expect(FILE_SIZE_LIMITS.IMAGE).toBe(10 * 1024 * 1024); // 10MB
      expect(FILE_SIZE_LIMITS.DOCUMENT).toBe(25 * 1024 * 1024); // 25MB
    });
  });
});
