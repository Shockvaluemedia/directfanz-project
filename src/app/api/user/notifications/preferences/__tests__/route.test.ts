import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { GET, PUT } from '../route';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@/lib/notifications';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Use the globally mocked functions
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetUserNotificationPreferences = getUserNotificationPreferences as jest.MockedFunction<
  typeof getUserNotificationPreferences
>;
const mockUpdateUserNotificationPreferences =
  updateUserNotificationPreferences as jest.MockedFunction<
    typeof updateUserNotificationPreferences
  >;

describe('/api/user/notifications/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return user notification preferences', async () => {
      const mockPreferences = {
        newContent: true,
        comments: false,
        subscriptionUpdates: true,
      };

      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      } as any);
      mockGetUserNotificationPreferences.mockResolvedValue(mockPreferences);

      const request = new NextRequest('http://localhost/api/user/notifications/preferences');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toEqual(mockPreferences);
      expect(mockGetUserNotificationPreferences).toHaveBeenCalledWith('user-1');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/user/notifications/preferences');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should handle errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      } as any);
      mockGetUserNotificationPreferences.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/user/notifications/preferences');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe('PUT', () => {
    it('should update user notification preferences', async () => {
      const updatedPreferences = {
        newContent: false,
        comments: true,
        subscriptionUpdates: true,
      };

      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      } as any);
      mockUpdateUserNotificationPreferences.mockResolvedValue(updatedPreferences);

      const request = new NextRequest('http://localhost/api/user/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          newContent: false,
          comments: true,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toEqual(updatedPreferences);
      expect(mockUpdateUserNotificationPreferences).toHaveBeenCalledWith('user-1', {
        newContent: false,
        comments: true,
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/user/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          newContent: false,
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid request data', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      } as any);

      const request = new NextRequest('http://localhost/api/user/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          newContent: 'invalid', // Should be boolean
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('should handle errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      } as any);
      mockUpdateUserNotificationPreferences.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/user/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          newContent: false,
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
    });
  });
});
