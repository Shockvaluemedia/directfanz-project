import { emailService, EmailVerificationService, emailTemplates } from '@/lib/email-service';

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Templates', () => {
    it('should generate welcome email template for artist', () => {
      const variables = { name: 'John Doe', role: 'ARTIST' };
      const template = emailTemplates.welcome(variables);

      expect(template.subject).toBe('Welcome to Direct Fan, John Doe!');
      expect(template.html).toContain('Welcome to Direct Fan!');
      expect(template.html).toContain('as an artist');
      expect(template.html).toContain('🎨 Getting Started as an Artist');
      expect(template.text).toContain('Getting Started as an Artist:');
    });

    it('should generate welcome email template for fan', () => {
      const variables = { name: 'Jane Smith', role: 'FAN' };
      const template = emailTemplates.welcome(variables);

      expect(template.subject).toBe('Welcome to Direct Fan, Jane Smith!');
      expect(template.html).toContain('as a fan');
      expect(template.html).toContain('⭐ Getting Started as a Fan');
      expect(template.text).toContain('Getting Started as a Fan:');
    });

    it('should generate email verification template', () => {
      const variables = {
        name: 'Test User',
        verificationUrl: 'https://example.com/verify?token=123',
      };
      const template = emailTemplates.emailVerification(variables);

      expect(template.subject).toBe('Verify your Direct Fan email address');
      expect(template.html).toContain('Verify Your Email');
      expect(template.html).toContain(variables.verificationUrl);
      expect(template.text).toContain(variables.verificationUrl);
    });

    it('should generate password reset template', () => {
      const variables = {
        name: 'Test User',
        resetUrl: 'https://example.com/reset?token=456',
      };
      const template = emailTemplates.passwordReset(variables);

      expect(template.subject).toBe('Reset your Direct Fan password');
      expect(template.html).toContain('Password Reset');
      expect(template.html).toContain(variables.resetUrl);
      expect(template.text).toContain(variables.resetUrl);
    });

    it('should generate subscription confirmation template', () => {
      const variables = {
        fanName: 'Fan User',
        artistName: 'Artist Name',
        tierName: 'Premium',
        amount: 9.99,
      };
      const template = emailTemplates.subscriptionConfirmation(variables);

      expect(template.subject).toBe('Subscription Confirmed - Artist Name');
      expect(template.html).toContain('Subscription Confirmed!');
      expect(template.html).toContain('Fan User');
      expect(template.html).toContain('Artist Name');
      expect(template.html).toContain('Premium');
      expect(template.html).toContain('$9.99');
    });

    it('should generate payment failed template', () => {
      const variables = {
        name: 'Test User',
        amount: 19.99,
        artistName: 'Artist Name',
        retryUrl: 'https://example.com/retry',
      };
      const template = emailTemplates.paymentFailed(variables);

      expect(template.subject).toBe('Payment Failed - Action Required');
      expect(template.html).toContain('Payment Failed');
      expect(template.html).toContain('$19.99');
      expect(template.html).toContain('Artist Name');
      expect(template.html).toContain(variables.retryUrl);
    });
  });

  describe('Email Sending', () => {
    it('should send email with template', async () => {
      const mockSendViaSendGrid = jest
        .spyOn(emailService as any, 'sendViaSendGrid')
        .mockResolvedValue({ success: true, messageId: 'msg_123' });

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        template: 'welcome',
        variables: { name: 'Test User', role: 'FAN' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123');
      expect(mockSendViaSendGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Welcome to Direct Fan, Test User!',
          html: expect.stringContaining('Welcome to Direct Fan!'),
          text: expect.stringContaining('Welcome to Direct Fan, Test User!'),
        })
      );
    });

    it('should validate email addresses', async () => {
      const result = await emailService.sendEmail({
        to: 'invalid-email',
        subject: 'Test',
        text: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should handle multiple recipients', async () => {
      const mockSendViaSendGrid = jest
        .spyOn(emailService as any, 'sendViaSendGrid')
        .mockResolvedValue({ success: true, messageId: 'msg_123' });

      const result = await emailService.sendEmail({
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test',
        text: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(mockSendViaSendGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test1@example.com', 'test2@example.com'],
        })
      );
    });

    it('should handle email sending errors', async () => {
      const mockSendViaSendGrid = jest
        .spyOn(emailService as any, 'sendViaSendGrid')
        .mockRejectedValue(new Error('SendGrid error'));

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SendGrid error');
    });
  });

  describe('Email Verification', () => {
    it('should send email verification successfully', async () => {
      const mockSendEmail = jest
        .spyOn(emailService, 'sendEmail')
        .mockResolvedValue({ success: true });

      const result = await emailService.sendEmailVerification(
        'test@example.com',
        'Test User',
        'verification-token-123'
      );

      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        template: 'emailVerification',
        variables: {
          name: 'Test User',
          verificationUrl: expect.stringContaining('verification-token-123'),
        },
      });
    });

    it('should handle email verification failure', async () => {
      const mockSendEmail = jest
        .spyOn(emailService, 'sendEmail')
        .mockResolvedValue({ success: false });

      const result = await emailService.sendEmailVerification(
        'test@example.com',
        'Test User',
        'verification-token-123'
      );

      expect(result).toBe(false);
    });
  });

  describe('Password Reset', () => {
    it('should send password reset successfully', async () => {
      const mockSendEmail = jest
        .spyOn(emailService, 'sendEmail')
        .mockResolvedValue({ success: true });

      const result = await emailService.sendPasswordReset(
        'test@example.com',
        'Test User',
        'reset-token-456'
      );

      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        template: 'passwordReset',
        variables: {
          name: 'Test User',
          resetUrl: expect.stringContaining('reset-token-456'),
        },
      });
    });
  });
});

describe('EmailVerificationService', () => {
  afterEach(() => {
    // Clear the internal token storage
    (EmailVerificationService as any).verificationTokens.clear();
  });

  it('should generate verification tokens', () => {
    const token1 = EmailVerificationService.generateVerificationToken();
    const token2 = EmailVerificationService.generateVerificationToken();

    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThan(10);
  });

  it('should store and verify tokens', () => {
    const email = 'test@example.com';
    const token = 'test-token';

    EmailVerificationService.storeVerificationToken(email, token);
    const result = EmailVerificationService.verifyToken(token);

    expect(result.valid).toBe(true);
    expect(result.email).toBe(email);
  });

  it('should reject invalid tokens', () => {
    const result = EmailVerificationService.verifyToken('invalid-token');

    expect(result.valid).toBe(false);
    expect(result.email).toBeUndefined();
  });

  it('should reject expired tokens', () => {
    const email = 'test@example.com';
    const token = 'test-token';

    // Store token with manipulated expiry
    const tokenData = {
      email,
      expires: Date.now() - 1000, // Expired 1 second ago
    };
    (EmailVerificationService as any).verificationTokens.set(token, tokenData);

    const result = EmailVerificationService.verifyToken(token);

    expect(result.valid).toBe(false);
    expect(result.email).toBeUndefined();
  });

  it('should remove token after verification', () => {
    const email = 'test@example.com';
    const token = 'test-token';

    EmailVerificationService.storeVerificationToken(email, token);

    // First verification should succeed
    const result1 = EmailVerificationService.verifyToken(token);
    expect(result1.valid).toBe(true);

    // Second verification should fail (token consumed)
    const result2 = EmailVerificationService.verifyToken(token);
    expect(result2.valid).toBe(false);
  });
});
