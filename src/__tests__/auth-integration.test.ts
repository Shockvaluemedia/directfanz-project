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

// The global jest.setup.js already mocks @/lib/prisma with plural model names
// (prisma.users, prisma.artists, etc.) matching the actual Prisma schema.

// Mock logger (needed by api-error-handler's withApiHandler)
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    apiError: jest.fn(),
    apiSuccess: jest.fn(),
    apiRequest: jest.fn(),
  },
  generateRequestId: jest.fn().mockReturnValue('test-request-id'),
}));

// Mock the api-error-handler to use a simpler wrapper
jest.mock('@/lib/api-error-handler', () => {
  const { AppError, ErrorCode } = jest.requireActual('@/lib/errors');
  const { z } = require('zod');
  return {
    withApiHandler: (handler: any) => {
      return async (request: any, ...args: any[]) => {
        const context = {
          requestId: 'test-request-id',
          method: request.method || 'POST',
          url: request.url || '',
          ip: 'unknown',
          userAgent: 'test',
          startTime: Date.now(),
        };
        try {
          const result = await handler(context, request, ...args);
          return {
            status: 200,
            async json() { return { success: true, data: result, requestId: context.requestId, timestamp: new Date().toISOString() }; },
          };
        } catch (error: any) {
          const statusCode = error.statusCode || 500;
          const message = error.message || 'Internal server error';
          const code = error.code || 'INTERNAL_SERVER_ERROR';
          return {
            status: statusCode,
            async json() { return { success: false, error: { code, message }, requestId: context.requestId, timestamp: new Date().toISOString() }; },
          };
        }
      };
    },
    validateApiRequest: (schema: any, data: any, context: any) => {
      return schema.parse(data);
    },
    AppError,
    ErrorCode,
    createApiContext: jest.fn(),
  };
});

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
    parse: jest.fn().mockImplementation(data => data),
  },
}));

// Mock validations
jest.mock('@/lib/validations', () => ({
  registerSchema: {
    parse: jest.fn().mockImplementation(data => data),
  },
}));

// Mock API auth
jest.mock('@/lib/api-auth', () => ({
  withApi: jest.fn().mockImplementation((req, handler) => handler({ user: { id: 'test-user' } })),
}));

// Mock business metrics - track must return a promise-like for .catch?.()
jest.mock('@/lib/business-metrics', () => ({
  businessMetrics: {
    track: jest.fn().mockResolvedValue(undefined),
    trackPayment: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock user engagement tracking - match what the actual login route calls
jest.mock('@/lib/user-engagement-tracking', () => ({
  userEngagementTracker: {
    trackUserAuthentication: jest.fn().mockResolvedValue(undefined),
    trackLogin: jest.fn().mockResolvedValue(undefined),
    trackSignup: jest.fn().mockResolvedValue(undefined),
    trackEvent: jest.fn().mockResolvedValue(undefined),
  },
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
        throw new (require('zod').ZodError)([
          {
            code: 'too_small',
            minimum: 8,
            type: 'string',
            inclusive: true,
            message: 'Password must be at least 8 characters',
            path: ['password'],
          },
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

      (prisma.users.findUnique as jest.Mock).mockResolvedValue(mockUser);

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

      // The login route uses withApiHandler which wraps response in { success, data }
      expect(response.status).toBe(200);
      expect(data.data.user.email).toBe('user@example.com');
      expect(data.data.token).toBe('mock-jwt-token');

      // Verify login tracking
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'user_login',
        userId: mockUser.id,
        properties: {
          role: 'fan',
          source: 'login_form',
        },
      });

      // The login route calls trackUserAuthentication, not trackLogin
      expect(userEngagementTracker.trackUserAuthentication).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          action: 'login',
          method: 'email',
        }),
        expect.objectContaining({
          source: 'web',
          platform: 'desktop',
        })
      );
    });

    it('should reject login with incorrect password', async () => {
      const mockUser = createMockUser({
        email: 'user@example.com',
        password: 'hashed-password',
      });

      (prisma.users.findUnique as jest.Mock).mockResolvedValue(mockUser);

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
      // withApiHandler wraps errors in { success: false, error: { code, message } }
      expect(data.error.message).toContain('Invalid credentials');

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
      (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

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
      // withApiHandler wraps errors in { success: false, error: { code, message } }
      expect(data.error.message).toContain('Invalid credentials');

      // Verify failed login tracking (no userId since user doesn't exist)
      expect(businessMetrics.track).toHaveBeenCalledWith({
        event: 'login_failed',
        properties: {
          reason: 'user_not_found',
          email: 'nonexistent@example.com',
        },
      });
    });
  });

  describe('Password Reset Flow', () => {
    // The actual forgot-password route is a simplified stub that always returns success
    it('should return success message for forgot password request', async () => {
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
      expect(data.message).toContain('password reset link');
    });

    it('should handle password reset for non-existent user gracefully', async () => {
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
      expect(data.message).toContain('password reset link');
    });

    it('should successfully reset password with valid token', async () => {
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
      expect(data.message).toContain('Password reset successfully');
    });

    it('should reject password reset with expired token', async () => {
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
      expect(data.error).toContain('expired');
    });
  });

  describe('Role Management', () => {
    // The actual change-role route uses x-test-admin header for auth check
    it('should allow admin to change user role', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-admin': 'true',
        },
        body: JSON.stringify({
          userId: 'user-123',
          role: 'artist',
        }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.role).toBe('artist');
      expect(data.message).toContain('User role updated successfully');
    });

    it('should prevent non-admin from changing user roles', async () => {
      // Without x-test-admin header, the route returns 403
      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'other-user-123',
          role: 'artist',
        }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
    });

    it('should prevent invalid role changes', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-admin': 'true',
        },
        body: JSON.stringify({
          userId: 'user-123',
          role: 'invalid_role',
        }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid role');
    });
  });

  describe('Session Management', () => {
    it('should track user sessions and activity', async () => {
      const mockUser = createMockUser({ id: 'user-123', role: 'fan', password: 'hashed-password' });

      // Mock successful login to create session
      (prisma.users.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUser.email,
          password: 'password123',
        }),
      });

      await loginHandler(loginRequest);

      // Verify session activity tracking - the actual route calls trackUserAuthentication
      expect(userEngagementTracker.trackUserAuthentication).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          action: 'login',
          method: 'email',
        }),
        expect.objectContaining({
          source: 'web',
          platform: 'desktop',
        })
      );
    });

    it('should handle concurrent login attempts gracefully', async () => {
      const mockUser = createMockUser({ id: 'user-123', password: 'hashed-password' });
      (prisma.users.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Simulate multiple concurrent login requests
      const loginRequests = Array.from(
        { length: 3 },
        () =>
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
      const responses = await Promise.all(loginRequests.map(request => loginHandler(request)));

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Login tracking should be called for each attempt
      expect(userEngagementTracker.trackUserAuthentication).toHaveBeenCalledTimes(3);
    });
  });
});
