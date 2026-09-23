/**
 * Email Service
 *
 * Handles sending emails for authentication, notifications, and business communications.
 * Uses SendGrid for email delivery.
 */

import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailOptions {
  email: string;
  resetToken: string;
  userName: string;
}

interface WelcomeEmailOptions {
  email: string;
  userName: string;
  role: 'fan' | 'artist';
}

/**
 * Base URL used to build links in emails. Falls back to NEXTAUTH_URL so a
 * missing NEXT_PUBLIC_APP_URL never produces an "undefined/..." link.
 */
function getAppBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return base.replace(/\/+$/, '');
}

/** User-controlled values (display names) must be escaped before entering HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send a generic email via SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
    console.warn('SendGrid not configured (missing SENDGRID_API_KEY or FROM_EMAIL), skipping email');
    return false;
  }

  try {
    await sgMail.send({
      to: options.to,
      from: process.env.FROM_EMAIL,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<boolean> {
  const resetUrl = `${getAppBaseUrl()}/auth/reset-password?token=${encodeURIComponent(options.resetToken)}`;

  return sendEmail({
    to: options.email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${escapeHtml(options.userName)},</p>
      <p>You requested a password reset for your account. Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
    text: `Password reset requested. Visit: ${resetUrl}`,
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(options: WelcomeEmailOptions): Promise<boolean> {
  const loginUrl = `${getAppBaseUrl()}/auth/login`;

  return sendEmail({
    to: options.email,
    subject: `Welcome to ${process.env.NEXT_PUBLIC_APP_NAME || 'Direct Fan Platform'}!`,
    html: `
      <h2>Welcome ${escapeHtml(options.userName)}!</h2>
      <p>Thanks for joining our platform as a ${options.role}.</p>
      ${
        options.role === 'artist'
          ? '<p>You can now create tiers, upload content, and connect with your fans!</p>'
          : '<p>You can now discover and support your favorite artists!</p>'
      }
      <a href="${loginUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a>
      <p>If you have any questions, feel free to reach out to our support team.</p>
    `,
    text: `Welcome ${options.userName}! Visit ${loginUrl} to get started.`,
  });
}
