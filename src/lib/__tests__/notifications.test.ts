import { jest } from '@jest/globals';

// Mock SendGrid first
const mockSend = jest.fn();
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: mockSend,
}));

// Mock Prisma
const mockPrisma = {
  content: {
    findUnique: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../prisma', () => ({
  prisma: mockPrisma,
}));

import { 
  sendEmail, 
  DEFAULT_NOTIFICATION_PREFERENCES
} from '../notifications';

describe('Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue(true);
    // Set environment variables for tests
    process.env.SENDGRID_API_KEY = 'test-key';
    process.env.FROM_EMAIL = 'test@example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test Text',
        html: '<p>Test HTML</p>',
      });
    });

    it('should handle missing environment variables', async () => {
      delete process.env.SENDGRID_API_KEY;
      
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });

      expect(result).toBeUndefined();
    });

    it('should handle SendGrid errors', async () => {
      mockSend.mockRejectedValue(new Error('SendGrid error'));
      
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });

      expect(result).toBe(false);
    });
  });

  describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
        newContent: true,
        comments: true,
        subscriptionUpdates: true,
      });
    });
  });
});