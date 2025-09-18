/**
 * Authentication and User Management Integration Tests
 * 
 * End-to-end tests for authentication flows including signup, login,
 * password reset, role changes, and session management
 */

import { NextRequest } from 'next/server';

// Mock NextAuth before any imports
jest.mock('next-auth', () => {
  const mockHandler = jest.fn();
  const mockNextAuth = jest.fn().mockImplementation(() => mockHandler);
  
  return {
    __esModule: true,
    default: mockNextAuth,
    getServerSession: jest.fn(),
  };
});

// Mock database connections
jest.mock('@/lib/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    artist: {
      create: jest.fn(),
    }
  },
}));

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    artist: {
      create: jest.fn(),
    }
  },
}));

// Mock the prisma instance used by the login route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    artist: {
      create: jest.fn(),
    }
  },
}));

// Mock API utilities
jest.mock('@/lib/api-utils', () => ({
  apiHandler: (fn: any) => fn,
  apiSuccess: (data: any, message: string) => ({ data, message }),
  apiError: (message: string, status: number) => ({ error: message, status }),
  parseAndValidate: jest.fn().mockImplementation(async (req, schema) => {
    return await req.json();
  }),
}));

// Mock auth utilities
const mockCreateUser = jest.fn();
jest.mock('@/lib/auth-utils', () => ({
  createUser: mockCreateUser,
  signUpSchema: {
    parse: jest.fn().mockImplementation((data) => data),
  },
}));

// Mock validations
jest.mock('@/lib/validations', () => ({
  registerSchema: {
    parse: jest.fn().mockImplementation((data) => data),
  },
}));

// Mock API auth
jest.mock('@/lib/api-auth', () => ({
  withApi: jest.fn().mockImplementation((req, handler) => handler({ user: { id: 'test-user' } })),
}));

// Mock business metrics
jest.mock('@/lib/business-metrics', () => ({
  businessMetrics: {
    track: jest.fn(),
    trackPayment: jest.fn(),
  }
}));

// Mock user engagement tracking
jest.mock('@/lib/user-engagement-tracking', () => ({
  userEngagementTracker: {
    trackLogin: jest.fn(),
    trackSignup: jest.fn(),
    trackEvent: jest.fn(),
  }
}));

import { 
  setupTestEnvironment,
  createMockUser,
  createMockArtist,
  mockAuthenticatedRequest,
  mockSession,
  mockPrismaUser,
  mockPrismaArtist,
  mockPrismaProfile,
} from '@/lib/test-utils';

// Import the mocked prisma instance
import { prisma } from '@/lib/prisma';

// Import the modules we're testing after mocks are set up
const { POST: signupHandler } = require('@/app/api/auth/signup/route');
const { POST: registerHandler } = require('@/app/api/auth/register/route');
const { POST: changePasswordHandler } = require('@/app/api/auth/change-password/route');
const { POST: loginHandler } = require('@/app/api/auth/login/route');
const { POST: forgotPasswordHandler } = require('@/app/api/auth/forgot-password/route');
const { POST: resetPasswordHandler } = require('@/app/api/auth/reset-password/route');
const { POST: changeRoleHandler } = require('@/app/api/admin/change-role/route');
const { businessMetrics } = require('@/lib/business-metrics');
const { userEngagementTracker } = require('@/lib/user-engagement-tracking');

// Mock bcrypt for password hashing
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock JWT for tokens
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', email: 'test@example.com' }),
}));

// Mock email service
const mockSendEmail = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

describe('Authentication Integration Tests', () => {
  setupTestEnvironment();

  beforeEach(() => {
    // Reset all mocks
    mockSendEmail.mockClear();
    Object.values(businessMetrics).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
    Object.values(userEngagementTracker).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });

  describe('User Registration Flow', () => {
    it('should successfully register a new fan user', async () => {
      // Mock user creation in auth-utils
      const mockUser = createMockUser({
        id: 'new-user-123',
        email: 'newuser@example.com',
        role: 'fan',
        profileComplete: false,
        password: 'hashed-password', // Include password so destructuring works
      });
      mockCreateUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
          firstName: 'New',
          lastName: 'User',
          role: 'fan',
        }),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('User created successfully');
      expect(data.user.email).toBe('newuser@example.com');
      expect(data.user.role).toBe('fan');
      expect(data.user.password).toBeUndefined(); // Password should be excluded

      // Verify the createUser function was called with correct data
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User',
        role: 'fan',
      });
    });

    it('should successfully register a new artist user and create artist profile', async () => {
      // Mock user and artist creation using the auth-utils createUser function
      const mockUser = createMockUser({
        id: 'new-artist-123',
        email: 'newartist@example.com',
        role: 'artist',
        profileComplete: false,
      });
      
      const mockArtist = createMockArtist({
        id: 'artist-profile-123',
        userId: 'new-artist-123',
        stage_name: 'New Artist',
        verified: false,
      });

      // Mock the createUser function to return artist user with artist profile
      mockCreateUser.mockResolvedValue({
        ...mockUser,
        artist: mockArtist,
        password: 'hashed-password', // Include for destructuring
      });

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newartist@example.com',
          password: 'SecurePassword123!',
          firstName: 'New',
          lastName: 'Artist',
          role: 'artist',
          stageName: 'New Artist',
          genre: 'Hip Hop',
        }),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.role).toBe('artist');
      expect(data.user.artist).toBeDefined();
      expect(data.user.artist.stage_name).toBe('New Artist');

      // Verify the createUser function was called with correct data
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'newartist@example.com',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'Artist',
        role: 'artist',
        stageName: 'New Artist',
        genre: 'Hip Hop',
      });
    });

    it('should reject registration with existing email', async () => {
      // Mock createUser to throw error for existing email
      mockCreateUser.mockRejectedValue(new Error('User already exists with this email'));

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'fan',
        }),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('User already exists with this email');
    });

    it('should validate password requirements', async () => {
      // Mock signUpSchema to throw validation error for weak password
      const mockSignUpSchema = require('@/lib/auth-utils').signUpSchema;
      mockSignUpSchema.parse.mockImplementation(() => {
        throw new (require('zod')).ZodError([
          {
            code: 'too_small',
            minimum: 8,
            type: 'string',
            inclusive: true,
            message: 'Password must be at least 8 characters',
            path: ['password']
          }
        ]);
      });

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'weak', // Weak password
          firstName: 'Test',
          lastName: 'User',
          role: 'fan',
        }),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });
  });

  describe('User Login Flow', () => {
    it('should successfully login existing user', async () => {
      const mockUser = createMockUser({
        id: 'existing-user-123',
        email: 'user@example.com',
        password: 'hashed-password',
        role: 'fan',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'plaintext-password',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.email).toBe('user@example.com');
      expect(data.token).toBe('mock-jwt-token');

      // Verify login tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'user_login',
        userId: mockUser.id,
        properties: {
          role: 'fan',
          source: 'login_form',
        },
      });

      expect(userEngagementTracker.trackLogin).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          loginMethod: 'email',
          role: 'fan',
        })
      );
    });

    it('should reject login with incorrect password', async () => {
      const mockUser = createMockUser({
        email: 'user@example.com',
        password: 'hashed-password',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock bcrypt to return false for incorrect password
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid credentials');

      // Verify failed login tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'login_failed',
        userId: mockUser.id,
        properties: {
          reason: 'invalid_password',
          email: 'user@example.com',
        },
      });
    });

    it('should reject login for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'any-password',
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid credentials');

      // Verify failed login tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'login_failed',
        userId: null,
        properties: {
          reason: 'user_not_found',
          email: 'nonexistent@example.com',
        },
      });
    });
  });

  describe('Password Reset Flow', () => {
    it('should send password reset email for existing user', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'user@example.com',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      });

      const response = await forgotPasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Password reset email sent');

      // Verify reset token was saved
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        data: {
          resetToken: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        },
      });

      // Verify email was sent
      expect(mockSendEmail).toHaveBeenCalled();

      // Verify tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'password_reset_requested',
        userId: mockUser.id,
        properties: {
          email: 'user@example.com',
        },
      });
    });

    it('should handle password reset for non-existent user gracefully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
        }),
      });

      const response = await forgotPasswordHandler(request);
      const data = await response.json();

      // Should still return 200 for security reasons
      expect(response.status).toBe(200);
      expect(data.message).toContain('Password reset email sent');

      // But no email should actually be sent
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should successfully reset password with valid token', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'user@example.com',
        resetToken: 'valid-reset-token',
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      });

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: 'new-hashed-password',
        resetToken: null,
        resetTokenExpiry: null,
      });

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-reset-token',
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const response = await resetPasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Password reset successful');

      // Verify password was updated and token cleared
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          password: 'hashed-password',
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      // Verify tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'password_reset_completed',
        userId: mockUser.id,
        properties: {
          email: mockUser.email,
        },
      });
    });

    it('should reject password reset with expired token', async () => {
      const mockUser = createMockUser({
        resetToken: 'expired-token',
        resetTokenExpiry: new Date(Date.now() - 3600000), // 1 hour ago
      });

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'expired-token',
          newPassword: 'NewSecurePassword123!',
        }),
      });

      const response = await resetPasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid or expired reset token');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Role Management', () => {
    it('should allow admin to change user role from fan to artist', async () => {
      const adminUser = createMockUser({ id: 'admin-123', role: 'admin' });
      const targetUser = createMockUser({ 
        id: 'user-123', 
        email: 'user@example.com',
        role: 'fan' 
      });

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(targetUser) // First call for target user
        .mockResolvedValueOnce({ ...targetUser, role: 'artist' }); // Second call for updated user

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...targetUser,
        role: 'artist',
        artist: createMockArtist({ userId: 'user-123' }),
      });

      const request = mockAuthenticatedRequest('POST', {
        userId: 'user-123',
        newRole: 'artist',
        stageName: 'New Artist Name',
        genre: 'Pop',
      }, mockSession({ user: adminUser }));

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.role).toBe('artist');

      // Verify user was updated
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          role: 'artist',
          artist: {
            create: {
              stage_name: 'New Artist Name',
              genre: 'Pop',
              verified: false,
            },
          },
        },
        include: expect.any(Object),
      });

      // Verify role change tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'user_role_changed',
        userId: 'user-123',
        properties: {
          previousRole: 'fan',
          newRole: 'artist',
          changedBy: 'admin-123',
        },
      });
    });

    it('should prevent non-admin from changing user roles', async () => {
      const regularUser = createMockUser({ id: 'user-123', role: 'fan' });

      const request = mockAuthenticatedRequest('POST', {
        userId: 'other-user-123',
        newRole: 'artist',
      }, mockSession({ user: regularUser }));

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Admin access required');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should prevent invalid role changes', async () => {
      const adminUser = createMockUser({ id: 'admin-123', role: 'admin' });

      const request = mockAuthenticatedRequest('POST', {
        userId: 'user-123',
        newRole: 'invalid_role',
      }, mockSession({ user: adminUser }));

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid role');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should track user sessions and activity', async () => {
      const mockUser = createMockUser({ id: 'user-123', role: 'fan' });

      // Mock successful login to create session
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUser.email,
          password: 'password123',
        }),
      });

      await loginHandler(loginRequest);

      // Verify session activity tracking
      expect(userEngagementTracker.trackLogin).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          loginMethod: 'email',
          role: 'fan',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle concurrent login attempts gracefully', async () => {
      const mockUser = createMockUser({ id: 'user-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Simulate multiple concurrent login requests
      const loginRequests = Array.from({ length: 3 }, () => 
        new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mockUser.email,
            password: 'password123',
          }),
        })
      );

      // Execute all requests concurrently
      const responses = await Promise.all(
        loginRequests.map(request => loginHandler(request))
      );

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Login tracking should be called for each attempt
      expect(userEngagementTracker.trackLogin).toHaveBeenCalledTimes(3);
    });
  });
});