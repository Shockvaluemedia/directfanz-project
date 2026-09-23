/**
 * Authentication and User Management Integration Tests
 *
 * End-to-end tests for authentication flows including signup, login,
 * password reset, role changes, and session management
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

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
    securityEvent: jest.fn(),
  },
  generateRequestId: jest.fn().mockReturnValue('test-request-id'),
}));

// Mock email service. Declared before the route handlers are required below:
// the forgot-password route imports @/lib/email, so this factory runs during
// that require, and `mockSendEmail` must already be initialised by then.
const mockSendEmail = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
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
    const { sendPasswordResetEmail } = require('@/lib/email');
    const { logger } = require('@/lib/logger');
    const { hashResetToken, resetIdentifierFor } = require('@/lib/password-reset');

    // Each request gets its own client IP so the per-IP limiter never bleeds
    // between tests; the per-email limiter is keyed by address.
    let ipCounter = 0;
    const jsonRequest = (path: string, body: unknown, ip?: string) =>
      new NextRequest(`http://localhost:3000${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip ?? `10.0.0.${++ipCounter}`,
        },
        body: JSON.stringify(body),
      });

    beforeEach(() => {
      [prisma.users, prisma.verificationtokens, prisma.refresh_tokens].forEach(model => {
        Object.values(model).forEach((fn: any) => {
          if (jest.isMockFunction(fn)) fn.mockReset();
        });
      });
      // Run transaction callbacks against this same mocked client so the writes
      // inside them can be asserted (the global mock hands out a fresh client).
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
      sendPasswordResetEmail.mockReset();
      sendPasswordResetEmail.mockResolvedValue(true);
      logger.securityEvent.mockClear();
    });

    describe('forgot-password', () => {
      it('stores a hashed, expiring token and emails the raw one to an existing user', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          displayName: 'Casey',
          password: 'hashed-password',
        });

        const response = await forgotPasswordHandler(
          jsonRequest('/api/auth/forgot-password', { email: 'User@Example.com' })
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain('password reset link');

        // Email is normalised before lookup so it matches credentials sign-in.
        expect(prisma.users.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { email: 'user@example.com' } })
        );

        // Earlier links are invalidated, then only the hash of the new token is stored.
        expect(prisma.verificationtokens.deleteMany).toHaveBeenCalledWith({
          where: { identifier: resetIdentifierFor('user-1') },
        });
        const created = (prisma.verificationtokens.create as jest.Mock).mock.calls[0][0].data;
        expect(created.identifier).toBe(resetIdentifierFor('user-1'));
        expect(created.expires.getTime()).toBeGreaterThan(Date.now());

        // The emailed token is the raw one; what was stored is its hash.
        const emailed = sendPasswordResetEmail.mock.calls[0][0];
        expect(emailed).toMatchObject({ email: 'user@example.com', userName: 'Casey' });
        expect(emailed.resetToken).toMatch(/^[0-9a-f]{64}$/);
        expect(created.token).toBe(hashResetToken(emailed.resetToken));
        expect(created.token).not.toBe(emailed.resetToken);
      });

      it('returns the same response without sending anything for an unknown email', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await forgotPasswordHandler(
          jsonRequest('/api/auth/forgot-password', { email: 'nonexistent@example.com' })
        );
        const data = await response.json();

        // Still 200 so the endpoint can't be used to enumerate accounts.
        expect(response.status).toBe(200);
        expect(data.message).toContain('password reset link');
        expect(prisma.verificationtokens.create).not.toHaveBeenCalled();
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('does not issue a token for an OAuth-only account with no password', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({
          id: 'oauth-1',
          email: 'oauth@example.com',
          displayName: 'Sam',
          password: null,
        });

        const response = await forgotPasswordHandler(
          jsonRequest('/api/auth/forgot-password', { email: 'oauth@example.com' })
        );

        expect(response.status).toBe(200);
        expect(prisma.verificationtokens.create).not.toHaveBeenCalled();
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('rejects an invalid email address', async () => {
        const response = await forgotPasswordHandler(
          jsonRequest('/api/auth/forgot-password', { email: 'not-an-email' })
        );

        expect(response.status).toBe(400);
        expect(prisma.users.findUnique).not.toHaveBeenCalled();
      });

      it('rate limits repeated requests for the same email address', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
        const statuses: number[] = [];

        for (let i = 0; i < 4; i++) {
          // Fresh IP each time so only the per-email limit (3/hour) is in play.
          const response = await forgotPasswordHandler(
            jsonRequest('/api/auth/forgot-password', { email: 'flood@example.com' }, `10.9.9.${i}`)
          );
          statuses.push(response.status);
        }

        expect(statuses).toEqual([200, 200, 200, 429]);
      });
    });

    describe('reset-password', () => {
      const validToken = 'valid-reset-token';
      const liveTokenRow = () => ({
        identifier: resetIdentifierFor('user-1'),
        token: hashResetToken(validToken),
        expires: new Date(Date.now() + 60 * 60 * 1000),
      });
      const resetBody = { token: validToken, newPassword: 'NewSecurePassword123!' };

      it('sets the new password, consumes the token, and revokes refresh tokens', async () => {
        (prisma.verificationtokens.findUnique as jest.Mock).mockResolvedValue(liveTokenRow());
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });

        const response = await resetPasswordHandler(
          jsonRequest('/api/auth/reset-password', resetBody)
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain('Password reset successfully');

        // Looked up by hash, never by the raw token.
        expect(prisma.verificationtokens.findUnique).toHaveBeenCalledWith({
          where: { token: hashResetToken(validToken) },
        });
        expect(prisma.users.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'user-1' },
            data: expect.objectContaining({ password: 'hashed-password' }),
          })
        );
        // Single-use: the token row is removed once consumed.
        expect(prisma.verificationtokens.deleteMany).toHaveBeenCalledWith({
          where: { identifier: resetIdentifierFor('user-1') },
        });
        expect(prisma.refresh_tokens.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId: 'user-1', isRevoked: false },
            data: expect.objectContaining({ isRevoked: true }),
          })
        );
        expect(logger.securityEvent).toHaveBeenCalledWith(
          'password_reset_completed',
          'medium',
          expect.objectContaining({ userId: 'user-1' })
        );
      });

      it('rejects an expired token and cleans it up', async () => {
        (prisma.verificationtokens.findUnique as jest.Mock).mockResolvedValue({
          ...liveTokenRow(),
          expires: new Date(Date.now() - 1000),
        });

        const response = await resetPasswordHandler(
          jsonRequest('/api/auth/reset-password', resetBody)
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('expired');
        expect(prisma.users.update).not.toHaveBeenCalled();
        expect(prisma.verificationtokens.deleteMany).toHaveBeenCalledWith({
          where: { token: hashResetToken(validToken) },
        });
      });

      it('rejects an unknown token', async () => {
        (prisma.verificationtokens.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await resetPasswordHandler(
          jsonRequest('/api/auth/reset-password', { ...resetBody, token: 'nope' })
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('invalid');
        expect(prisma.users.update).not.toHaveBeenCalled();
      });

      it('ignores tokens that are not password-reset tokens', async () => {
        // A NextAuth magic-link row uses the email address as its identifier.
        (prisma.verificationtokens.findUnique as jest.Mock).mockResolvedValue({
          ...liveTokenRow(),
          identifier: 'user@example.com',
        });

        const response = await resetPasswordHandler(
          jsonRequest('/api/auth/reset-password', resetBody)
        );

        expect(response.status).toBe(400);
        expect(prisma.users.update).not.toHaveBeenCalled();
      });

      it('rejects a password shorter than 8 characters', async () => {
        const response = await resetPasswordHandler(
          jsonRequest('/api/auth/reset-password', { ...resetBody, newPassword: 'short' })
        );

        expect(response.status).toBe(400);
        expect(prisma.verificationtokens.findUnique).not.toHaveBeenCalled();
      });
    });
  });

  describe('Role Management', () => {
    // The change-role route requires a real authenticated ADMIN session and
    // verifies the caller's role against the database before mutating anything.
    beforeEach(() => {
      (getServerSession as jest.Mock).mockReset();
      (prisma.users.update as jest.Mock).mockReset();
    });

    it('should allow admin to change user role', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } });
      // Actor lookup returns an ADMIN, then the target update returns the new role
      (prisma.users.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN' });
      (prisma.users.update as jest.Mock).mockResolvedValue({ id: 'user-123', role: 'ARTIST' });

      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-123',
          role: 'artist',
        }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.role).toBe('ARTIST');
      expect(data.message).toContain('User role updated successfully');
      expect(prisma.users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({ role: 'ARTIST' }),
        })
      );
    });

    it('should reject an unauthenticated request', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'other-user-123', role: 'artist' }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
      expect(prisma.users.update).not.toHaveBeenCalled();
    });

    it('should prevent a non-admin from changing user roles', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'fan-1' } });
      (prisma.users.findUnique as jest.Mock).mockResolvedValue({ role: 'FAN' });

      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'other-user-123', role: 'artist' }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
      expect(prisma.users.update).not.toHaveBeenCalled();
    });

    it('should prevent invalid role changes', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } });
      (prisma.users.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN' });

      const request = new NextRequest('http://localhost:3000/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-123',
          role: 'invalid_role',
        }),
      });

      const response = await changeRoleHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid role');
      expect(prisma.users.update).not.toHaveBeenCalled();
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
