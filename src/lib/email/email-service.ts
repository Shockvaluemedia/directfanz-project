import { logger } from '@/lib/logger';

/**
 * Email service for sending transactional emails
 * Supports multiple providers (SendGrid, Resend, etc.)
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // TODO: Integrate with actual email provider (SendGrid, Resend, etc.)
    // For now, just log what would be sent

    logger.info('Email would be sent', {
      to: options.to,
      subject: options.subject,
    });

    // In production, this would call the email API:
    // const response = await emailProvider.send(options);
    // return response.success;

    return true;
  } catch (error: any) {
    logger.error('Failed to send email', {
      to: options.to,
      subject: options.subject,
      error: error.message,
    });
    return false;
  }
}

/**
 * Send trial ending reminder (3 days before trial ends)
 */
export async function sendTrialEndingEmail(params: {
  fanEmail: string;
  fanName: string;
  artistName: string;
  tierName: string;
  amount: number;
  trialEndDate: Date;
}): Promise<boolean> {
  const { fanEmail, fanName, artistName, tierName, amount, trialEndDate } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your trial is ending soon</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">DirectFanz</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #667eea; margin-top: 0;">Your trial is ending soon</h2>

    <p>Hi ${fanName},</p>

    <p>Your free trial of <strong>${artistName}'s ${tierName}</strong> tier ends on <strong>${trialEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 18px;">
        <strong>After your trial:</strong> $${amount.toFixed(2)}/month
      </p>
    </div>

    <p>Your subscription will automatically continue at $${amount.toFixed(2)} per month after the trial ends. You can cancel anytime before then to avoid being charged.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/subscriptions"
         style="background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Manage Subscription
      </a>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Questions? Reply to this email and we'll be happy to help.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>DirectFanz - Support creators you love</p>
    <p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #667eea; text-decoration: none;">Visit DirectFanz</a>
    </p>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${fanName},

Your free trial of ${artistName}'s ${tierName} tier ends on ${trialEndDate.toLocaleDateString()}.

After your trial: $${amount.toFixed(2)}/month

Your subscription will automatically continue at $${amount.toFixed(2)} per month after the trial ends. You can cancel anytime before then to avoid being charged.

Manage your subscription: ${process.env.NEXT_PUBLIC_APP_URL}/subscriptions

Questions? Reply to this email and we'll be happy to help.

DirectFanz - Support creators you love
  `;

  return sendEmail({
    to: fanEmail,
    subject: `Your trial ends in 3 days - ${artistName}`,
    html,
    text,
  });
}

/**
 * Send trial converted to paid email
 */
export async function sendTrialConvertedEmail(params: {
  fanEmail: string;
  fanName: string;
  artistName: string;
  tierName: string;
  amount: number;
}): Promise<boolean> {
  const { fanEmail, fanName, artistName, tierName, amount } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your subscription is now active</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">DirectFanz</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #10b981; margin-top: 0;">✓ Your subscription is now active!</h2>

    <p>Hi ${fanName},</p>

    <p>Thank you for continuing your support of <strong>${artistName}</strong>! Your free trial has ended and your subscription is now active.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0 0 10px 0;"><strong>Subscription Details:</strong></p>
      <p style="margin: 5px 0;">Tier: <strong>${tierName}</strong></p>
      <p style="margin: 5px 0;">Monthly: <strong>$${amount.toFixed(2)}</strong></p>
      <p style="margin: 5px 0;">Status: <strong>Active</strong></p>
    </div>

    <p>You'll continue to have full access to all exclusive content and perks. Your card will be charged $${amount.toFixed(2)} each month.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/artist/${artistName}"
         style="background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Content
      </a>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Thank you for supporting ${artistName}!
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>DirectFanz - Support creators you love</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: fanEmail,
    subject: `Your subscription to ${artistName} is active`,
    html,
    text: `Your subscription to ${artistName}'s ${tierName} tier is now active at $${amount.toFixed(2)}/month.`,
  });
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(params: {
  fanEmail: string;
  fanName: string;
  artistName: string;
  amount: number;
}): Promise<boolean> {
  const { fanEmail, fanName, artistName, amount } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment failed - action required</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">DirectFanz</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #ef4444; margin-top: 0;">⚠ Payment Failed</h2>

    <p>Hi ${fanName},</p>

    <p>We were unable to process your payment of <strong>$${amount.toFixed(2)}</strong> for your subscription to <strong>${artistName}</strong>.</p>

    <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
      <p style="margin: 0; color: #991b1b;">
        <strong>Action required:</strong> Please update your payment method to continue your subscription.
      </p>
    </div>

    <p>Your subscription will remain active for a few days while we retry the payment. To avoid interruption, please update your payment information as soon as possible.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/subscriptions"
         style="background: #ef4444; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Update Payment Method
      </a>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Need help? Reply to this email or contact support.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>DirectFanz - Support creators you love</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: fanEmail,
    subject: `Payment failed - ${artistName} subscription`,
    html,
    text: `Your payment of $${amount.toFixed(2)} for ${artistName} failed. Please update your payment method: ${process.env.NEXT_PUBLIC_APP_URL}/subscriptions`,
  });
}

/**
 * Send new subscriber notification to artist
 */
export async function sendNewSubscriberEmail(params: {
  artistEmail: string;
  artistName: string;
  fanName: string;
  tierName: string;
  isTrialing: boolean;
}): Promise<boolean> {
  const { artistEmail, artistName, fanName, tierName, isTrialing } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0;">
  <title>New subscriber!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">🎉 New Subscriber!</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi ${artistName},</p>

    <p>Great news! <strong>${fanName}</strong> just subscribed to your <strong>${tierName}</strong> tier${isTrialing ? ' (free trial)' : ''}!</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 18px;">
        ${isTrialing ? '🎁 Trial subscriber' : '💰 Paid subscriber'}
      </p>
    </div>

    <p>Keep up the great work and make sure to keep your content coming!</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/artist"
         style="background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Dashboard
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>DirectFanz - Support creators you love</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: artistEmail,
    subject: `🎉 New subscriber to your ${tierName} tier!`,
    html,
    text: `${fanName} just subscribed to your ${tierName} tier${isTrialing ? ' (free trial)' : ''}!`,
  });
}
