import sgMail from '@sendgrid/mail';

jest.unmock('@/lib/email');

const { sendPasswordResetEmail } = require('@/lib/email');

describe('password reset email', () => {
  const originalEnvironment = {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
    process.env.FROM_EMAIL = 'noreply@example.com';
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXTAUTH_URL = 'https://app.example.com';
    (sgMail.send as jest.Mock).mockReset().mockResolvedValue([{ statusCode: 202 }]);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    jest.restoreAllMocks();
  });

  it('uses the configured app URL and escapes a user-controlled display name', async () => {
    await expect(
      sendPasswordResetEmail({
        email: 'fan@example.com',
        resetToken: 'a'.repeat(64),
        userName: '<script>alert(1)</script>',
      })
    ).resolves.toBe(true);

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fan@example.com',
        from: 'noreply@example.com',
        html: expect.stringContaining('&lt;script&gt;alert(1)&lt;/script&gt;'),
        text: expect.stringContaining(
          `https://app.example.com/auth/reset-password?token=${'a'.repeat(64)}`
        ),
      })
    );
    expect((sgMail.send as jest.Mock).mock.calls[0][0].html).not.toContain('<script>');
  });

  it('does not send a broken link when no public application URL is configured', async () => {
    delete process.env.NEXTAUTH_URL;
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      sendPasswordResetEmail({
        email: 'fan@example.com',
        resetToken: 'b'.repeat(64),
        userName: 'Fan',
      })
    ).resolves.toBe(false);

    expect(sgMail.send).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      'Password reset email skipped because the application URL is not configured'
    );
  });

  it('does not log provider errors that may contain the reset token', async () => {
    const resetToken = 'c'.repeat(64);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (sgMail.send as jest.Mock).mockRejectedValue(new Error(`provider payload: ${resetToken}`));

    await expect(
      sendPasswordResetEmail({
        email: 'fan@example.com',
        resetToken,
        userName: 'Fan',
      })
    ).resolves.toBe(false);

    expect(consoleError).toHaveBeenCalledWith('Failed to send email');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(resetToken);
  });
});
