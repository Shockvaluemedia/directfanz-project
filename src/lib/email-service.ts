import { logger } from './logger';

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'nodemailer' | 'ses';
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: keyof typeof emailTemplates;
  variables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
  tags?: string[];
  headers?: Record<string, string>;
}

const emailConfig: EmailConfig = {
  provider: (process.env.EMAIL_PROVIDER as any) || 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@directfan.com',
  fromName: process.env.FROM_NAME || 'Direct Fan',
  replyTo: process.env.REPLY_TO_EMAIL,
};

// Email templates with professional styling
export const emailTemplates = {
  welcome: (variables: { name: string; role: string }): EmailTemplate => ({
    subject: `Welcome to Direct Fan, ${variables.name}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Direct Fan</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 40px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .highlight { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Direct Fan!</h1>
            <p>The platform where creators connect directly with their fans</p>
          </div>
          <div class="content">
            <h2>Hi ${variables.name}!</h2>
            <p>Welcome to Direct Fan! We're thrilled to have you join our community as ${variables.role === 'ARTIST' ? 'an artist' : 'a fan'}.</p>
            
            ${
              variables.role === 'ARTIST'
                ? `
              <div class="highlight">
                <h3>🎨 Getting Started as an Artist</h3>
                <ul>
                  <li>Complete your profile with photos and bio</li>
                  <li>Set up your subscription tiers</li>
                  <li>Upload your first exclusive content</li>
                  <li>Connect with your fans through messages</li>
                </ul>
              </div>
            `
                : `
              <div class="highlight">
                <h3>⭐ Getting Started as a Fan</h3>
                <ul>
                  <li>Discover amazing artists in our catalog</li>
                  <li>Subscribe to support your favorite creators</li>
                  <li>Access exclusive content and behind-the-scenes material</li>
                  <li>Connect directly with artists through messages</li>
                </ul>
              </div>
            `
            }
            
            <p>If you have any questions, don't hesitate to reach out to our support team.</p>
            
            <a href="${process.env.NEXTAUTH_URL}" class="button">Get Started</a>
          </div>
          <div class="footer">
            <p>© 2024 Direct Fan. All rights reserved.</p>
            <p>You're receiving this email because you signed up for Direct Fan.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Direct Fan, ${variables.name}!

We're thrilled to have you join our community as ${variables.role === 'ARTIST' ? 'an artist' : 'a fan'}.

${
  variables.role === 'ARTIST'
    ? `
Getting Started as an Artist:
- Complete your profile with photos and bio
- Set up your subscription tiers
- Upload your first exclusive content
- Connect with your fans through messages
`
    : `
Getting Started as a Fan:
- Discover amazing artists in our catalog
- Subscribe to support your favorite creators
- Access exclusive content and behind-the-scenes material
- Connect directly with artists through messages
`
}

Get started at: ${process.env.NEXTAUTH_URL}

If you have any questions, don't hesitate to reach out to our support team.

Best regards,
The Direct Fan Team
    `,
  }),

  emailVerification: (variables: { name: string; verificationUrl: string }): EmailTemplate => ({
    subject: 'Verify your Direct Fan email address',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .security-note { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Verify Your Email</h1>
          </div>
          <div class="content">
            <h2>Hi ${variables.name}!</h2>
            <p>Thanks for signing up for Direct Fan! Please verify your email address to complete your account setup.</p>
            
            <a href="${variables.verificationUrl}" class="button">Verify Email Address</a>
            
            <div class="security-note">
              <strong>🛡️ Security Note:</strong> This verification link will expire in 24 hours. If you didn't create an account with Direct Fan, you can safely ignore this email.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${variables.verificationUrl}</p>
          </div>
          <div class="footer">
            <p>© 2024 Direct Fan. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Verify Your Direct Fan Email Address

Hi ${variables.name}!

Thanks for signing up for Direct Fan! Please verify your email address to complete your account setup.

Click here to verify: ${variables.verificationUrl}

Security Note: This verification link will expire in 24 hours. If you didn't create an account with Direct Fan, you can safely ignore this email.

Best regards,
The Direct Fan Team
    `,
  }),

  passwordReset: (variables: { name: string; resetUrl: string }): EmailTemplate => ({
    subject: 'Reset your Direct Fan password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .security-note { background: #fef2f2; border: 1px solid #f87171; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hi ${variables.name}!</h2>
            <p>We received a request to reset your Direct Fan password. Click the button below to create a new password:</p>
            
            <a href="${variables.resetUrl}" class="button">Reset Password</a>
            
            <div class="security-note">
              <strong>🚨 Security Alert:</strong> This password reset link will expire in 1 hour. If you didn't request this reset, please contact our support team immediately.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${variables.resetUrl}</p>
          </div>
          <div class="footer">
            <p>© 2024 Direct Fan. All rights reserved.</p>
            <p>For security questions, contact: security@directfan.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Reset Your Direct Fan Password

Hi ${variables.name}!

We received a request to reset your Direct Fan password. Click the link below to create a new password:

${variables.resetUrl}

Security Alert: This password reset link will expire in 1 hour. If you didn't request this reset, please contact our support team immediately.

For security questions, contact: security@directfan.com

Best regards,
The Direct Fan Team
    `,
  }),

  subscriptionConfirmation: (variables: {
    fanName: string;
    artistName: string;
    tierName: string;
    amount: number;
  }): EmailTemplate => ({
    subject: `Subscription Confirmed - ${variables.artistName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .subscription-details { background: #f0fdf4; border: 1px solid #22c55e; padding: 20px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Subscription Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Thank you, ${variables.fanName}!</h2>
            <p>Your subscription to <strong>${variables.artistName}</strong> has been confirmed.</p>
            
            <div class="subscription-details">
              <h3>Subscription Details</h3>
              <p><strong>Artist:</strong> ${variables.artistName}</p>
              <p><strong>Tier:</strong> ${variables.tierName}</p>
              <p><strong>Amount:</strong> $${variables.amount}/month</p>
              <p><strong>Next billing:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
            </div>
            
            <p>You now have access to exclusive content from ${variables.artistName}. Visit your dashboard to explore what's available!</p>
            
            <a href="${process.env.NEXTAUTH_URL}/dashboard/fan" class="button">View Dashboard</a>
          </div>
          <div class="footer">
            <p>© 2024 Direct Fan. All rights reserved.</p>
            <p>Manage your subscriptions anytime in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Subscription Confirmed!

Thank you, ${variables.fanName}!

Your subscription to ${variables.artistName} has been confirmed.

Subscription Details:
- Artist: ${variables.artistName}
- Tier: ${variables.tierName}
- Amount: $${variables.amount}/month
- Next billing: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}

You now have access to exclusive content from ${variables.artistName}. Visit your dashboard to explore what's available!

Dashboard: ${process.env.NEXTAUTH_URL}/dashboard/fan

Best regards,
The Direct Fan Team
    `,
  }),

  paymentFailed: (variables: {
    name: string;
    amount: number;
    artistName: string;
    retryUrl: string;
  }): EmailTemplate => ({
    subject: 'Payment Failed - Action Required',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef2f2; border: 1px solid #f87171; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Payment Failed</h1>
          </div>
          <div class="content">
            <h2>Hi ${variables.name},</h2>
            <p>We couldn't process your payment of <strong>$${variables.amount}</strong> for your subscription to <strong>${variables.artistName}</strong>.</p>
            
            <div class="warning">
              <p><strong>Action Required:</strong> Please update your payment method to continue your subscription and maintain access to exclusive content.</p>
            </div>
            
            <p>Common reasons for payment failures:</p>
            <ul>
              <li>Insufficient funds</li>
              <li>Expired card</li>
              <li>Changed billing address</li>
              <li>Bank security measures</li>
            </ul>
            
            <a href="${variables.retryUrl}" class="button">Update Payment Method</a>
            
            <p>If you continue to experience issues, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>© 2024 Direct Fan. All rights reserved.</p>
            <p>Support: support@directfan.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Payment Failed - Action Required

Hi ${variables.name},

We couldn't process your payment of $${variables.amount} for your subscription to ${variables.artistName}.

Action Required: Please update your payment method to continue your subscription and maintain access to exclusive content.

Common reasons for payment failures:
- Insufficient funds
- Expired card
- Changed billing address
- Bank security measures

Update your payment method: ${variables.retryUrl}

If you continue to experience issues, please contact our support team at support@directfan.com.

Best regards,
The Direct Fan Team
    `,
  }),
};

class EmailService {
  private config: EmailConfig;

  constructor(config?: Partial<EmailConfig>) {
    this.config = { ...emailConfig, ...config };
  }

  // Send email with template
  async sendEmail(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let html = options.html;
      let text = options.text;
      let subject = options.subject;

      // Use template if specified
      if (options.template && options.variables) {
        const template = emailTemplates[options.template](options.variables);
        html = template.html;
        text = template.text;
        subject = template.subject;
      }

      // Validate email addresses
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      for (const email of recipients) {
        if (!this.isValidEmail(email)) {
          throw new Error(`Invalid email address: ${email}`);
        }
      }

      // Send via configured provider
      switch (this.config.provider) {
        case 'sendgrid':
          return await this.sendViaSendGrid({ ...options, html, text, subject });
        case 'mailgun':
          return await this.sendViaMailgun({ ...options, html, text, subject });
        case 'nodemailer':
          return await this.sendViaNodemailer({ ...options, html, text, subject });
        case 'ses':
          return await this.sendViaSES({ ...options, html, text, subject });
        default:
          throw new Error(`Unsupported email provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error(
        'Failed to send email',
        {
          provider: this.config.provider,
          to: options.to,
          template: options.template,
        },
        error as Error
      );

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Send email verification
  async sendEmailVerification(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${verificationToken}`;

    const result = await this.sendEmail({
      to: email,
      template: 'emailVerification',
      variables: { name, verificationUrl },
    });

    return result.success;
  }

  // Send password reset
  async sendPasswordReset(email: string, name: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    const result = await this.sendEmail({
      to: email,
      template: 'passwordReset',
      variables: { name, resetUrl },
    });

    return result.success;
  }

  // Provider-specific implementations
  private async sendViaSendGrid(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.config.apiKey);

      const msg = {
        to: options.to,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: this.config.replyTo,
        attachments: options.attachments,
        customArgs: options.tags ? { tags: options.tags.join(',') } : undefined,
      };

      const response = await sgMail.send(msg);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
      };
    } catch (error) {
      throw new Error(`SendGrid error: ${(error as Error).message}`);
    }
  }

  private async sendViaMailgun(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string }> {
    // Implementation for Mailgun
    throw new Error('Mailgun integration not implemented yet');
  }

  private async sendViaNodemailer(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string }> {
    // Implementation for Nodemailer
    throw new Error('Nodemailer integration not implemented yet');
  }

  private async sendViaSES(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string }> {
    // Implementation for AWS SES
    throw new Error('SES integration not implemented yet');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Singleton instance
export const emailService = new EmailService();

// Email verification utilities
export class EmailVerificationService {
  // Generate verification token
  static generateVerificationToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  // Store verification token (in production, use database)
  private static verificationTokens = new Map<string, { email: string; expires: number }>();

  static storeVerificationToken(email: string, token: string): void {
    this.verificationTokens.set(token, {
      email,
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  static verifyToken(token: string): { valid: boolean; email?: string } {
    const tokenData = this.verificationTokens.get(token);

    if (!tokenData || tokenData.expires < Date.now()) {
      return { valid: false };
    }

    this.verificationTokens.delete(token);
    return { valid: true, email: tokenData.email };
  }
}

export default emailService;
