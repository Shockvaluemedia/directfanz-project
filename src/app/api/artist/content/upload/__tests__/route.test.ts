/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { generatePresignedUrl, validateFileUpload } from '@/lib/s3';
import { describe, it, beforeEach } from '@jest/globals';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@/lib/s3');

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'mock-bucket';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGeneratePresignedUrl = generatePresignedUrl as jest.MockedFunction<
  typeof generatePresignedUrl
>;
const mockValidateFileUpload = validateFileUpload as jest.MockedFunction<typeof validateFileUpload>;

describe('/api/artist/content/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockArtistSession = {
    user: {
      id: 'artist-123',
      email: 'artist@example.com',
      role: 'ARTIST',
    },
  };

  const validUploadRequest = {
    fileName: 'test-song.mp3',
    fileType: 'audio/mpeg',
    fileSize: 5 * 1024 * 1024, // 5MB
  };

  it('should generate presigned URL for valid request', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);
    mockValidateFileUpload.mockReturnValue([]);
    mockGeneratePresignedUrl.mockResolvedValue({
      uploadUrl: 'https://mock-upload-url.com',
      fileUrl: 'https://mock-file-url.com',
      key: 'content/artist-123/test-song.mp3',
    });

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(validUploadRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('uploadUrl');
    expect(data.data).toHaveProperty('fileUrl');
    expect(data.data).toHaveProperty('key');
  });

  it('should reject request without authentication', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(validUploadRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject request from non-artist user', async () => {
    const fanSession = {
      user: {
        id: 'fan-123',
        email: 'fan@example.com',
        role: 'FAN',
      },
    };
    mockGetServerSession.mockResolvedValue(fanSession);

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(validUploadRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should validate request data', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);

    const invalidRequest = {
      fileName: '', // Invalid: empty filename
      fileType: 'audio/mpeg',
      fileSize: 5 * 1024 * 1024,
    };

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(invalidRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle file validation errors', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);
    mockValidateFileUpload.mockReturnValue(['File size too large']);

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(validUploadRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details.errors).toContain('File size too large');
  });

  it('should handle S3 errors', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);
    mockValidateFileUpload.mockReturnValue([]);
    mockGeneratePresignedUrl.mockRejectedValue(new Error('S3 connection failed'));

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(validUploadRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UPLOAD_ERROR');
    expect(data.error.message).toBe('S3 connection failed');
  });

  it('should handle malformed JSON', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('UPLOAD_ERROR');
  });

  it('should validate required fields', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);

    const incompleteRequest = {
      fileName: 'test.mp3',
      // Missing fileType and fileSize
    };

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(incompleteRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should validate file size is positive', async () => {
    mockGetServerSession.mockResolvedValue(mockArtistSession);

    const invalidRequest = {
      fileName: 'test.mp3',
      fileType: 'audio/mpeg',
      fileSize: -1, // Invalid: negative size
    };

    const request = new NextRequest('http://localhost:3000/api/artist/content/upload', {
      method: 'POST',
      body: JSON.stringify(invalidRequest),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
