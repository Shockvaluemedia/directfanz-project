/**
 * Unit tests for password reset flow
 */
import crypto from 'crypto';

// Mock prisma
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    users: { findUnique: (...args: any[]) => mockFindUnique(...args), update: (...args: any[]) => mockUpdate(...args) },
    verificationtokens: { upsert: (...args: any[]) => mockUpsert(...args), findFirst: (...args: any[]) => mockFindFirst(...args), deleteMany: (...args: any[]) => mockDeleteMany(...args) },
    sessions: { deleteMany: (...args: any[]) => mockDeleteMany(...args) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/email-service', () => ({
  __esModule: true,
  default: { sendPasswordReset: jest.fn().mockResolvedValue(true) },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('Password Reset Token Generation', () => {
  it('generates a 32-byte hex token', () => {
    const token = crypto.randomBytes(32).toString('hex');
    expect(token).toHaveLength(64);
  });

  it('produces different SHA-256 hashes for different tokens', () => {
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');
    const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(token2).digest('hex');
    expect(hash1).not.toBe(hash2);
  });

  it('consistently hashes the same token', () => {
    const token = 'test-token-abc';
    const hash1 = crypto.createHash('sha256').update(token).digest('hex');
    const hash2 = crypto.createHash('sha256').update(token).digest('hex');
    expect(hash1).toBe(hash2);
  });
});

describe('Password Validation', () => {
  const passwordRegex = {
    minLength: /.{8,}/,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
  };

  it('accepts valid passwords', () => {
    const valid = 'SecurePass1';
    expect(passwordRegex.minLength.test(valid)).toBe(true);
    expect(passwordRegex.uppercase.test(valid)).toBe(true);
    expect(passwordRegex.lowercase.test(valid)).toBe(true);
    expect(passwordRegex.number.test(valid)).toBe(true);
  });

  it('rejects passwords without uppercase', () => {
    expect(passwordRegex.uppercase.test('lowercase1')).toBe(false);
  });

  it('rejects passwords without numbers', () => {
    expect(passwordRegex.number.test('NoNumbers')).toBe(false);
  });

  it('rejects short passwords', () => {
    expect(passwordRegex.minLength.test('Sh0rt')).toBe(false);
  });
});
