import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { GET, POST } from '../route';
import { createComment, getCommentsByContentId } from '@/lib/database';
import { checkPermission } from '@/lib/rbac';
import { notifyContentComment } from '@/lib/notifications';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  createComment: jest.fn(),
  getCommentsByContentId: jest.fn(),
}));

jest.mock('@/lib/rbac', () => ({
  checkPermission: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  notifyContentComment: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockCreateComment = createComment as jest.MockedFunction<typeof createComment>;
const mockGetCommentsByContentId = getCommentsByContentId as jest.MockedFunction<typeof getCommentsByContentId>;
const mockCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const mockNotifyContentComment = notifyContentComment as jest.MockedFunction<typeof notifyContentComment>;

describe('/api/fan/comments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return comments for valid content ID', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          contentId: 'content-1',
          fanId: 'fan-1',
          text: 'Great content!',
          createdAt: new Date(),
          updatedAt: new Date(),
          fan: {
            id: 'fan-1',
            displayName: 'Fan User',
            avatar: null,
          },
        },
      ];

      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', role: 'FAN' },
      } as any);
      mockCheckPermission.mockResolvedValue(true);
      mockGetCommentsByContentId.mockResolvedValue(mockComments as any);

      const request = new NextRequest('http://localhost/api/fan/comments?contentId=content-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comments).toEqual(mockComments);
      expect(mockGetCommentsByContentId).toHaveBeenCalledWith('content-1');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/fan/comments?contentId=content-1');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for missing content ID', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', role: 'FAN' },
      } as any);

      const request = new NextRequest('http://localhost/api/fan/comments');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should return 403 for insufficient permissions', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', role: 'FAN' },
      } as any);
      mockCheckPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/fan/comments?contentId=content-1');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('POST', () => {
    it('should create comment successfully', async () => {
      const mockComment = {
        id: 'comment-1',
        contentId: 'content-1',
        fanId: 'user-1',
        text: 'Great content!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', name: 'Test User', role: 'FAN' },
      } as any);
      mockCheckPermission.mockResolvedValue(true);
      mockCreateComment.mockResolvedValue(mockComment as any);
      mockNotifyContentComment.mockResolvedValue();

      const request = new NextRequest('http://localhost/api/fan/comments', {
        method: 'POST',
        body: JSON.stringify({
          contentId: 'content-1',
          text: 'Great content!',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment).toEqual(mockComment);
      expect(mockCreateComment).toHaveBeenCalledWith({
        contentId: 'content-1',
        fanId: 'user-1',
        text: 'Great content!',
      });
      expect(mockNotifyContentComment).toHaveBeenCalledWith(
        'content-1',
        'Great content!',
        'Test User'
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/fan/comments', {
        method: 'POST',
        body: JSON.stringify({
          contentId: 'content-1',
          text: 'Great content!',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 for insufficient permissions', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', role: 'FAN' },
      } as any);
      mockCheckPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/fan/comments', {
        method: 'POST',
        body: JSON.stringify({
          contentId: 'content-1',
          text: 'Great content!',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid request data', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', role: 'FAN' },
      } as any);
      mockCheckPermission.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/fan/comments', {
        method: 'POST',
        body: JSON.stringify({
          contentId: 'content-1',
          text: '', // Empty text should fail validation
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});