import { logger } from '@/lib/logger';

/**
 * Provider-neutral text messaging. No SMS provider is chosen yet, so:
 *
 * - SMS_PROVIDER unset (the default): texts are switched off. Nothing is sent,
 *   and the fan list refuses text opt-ins and text announcements, so no one is
 *   told they'll get texts that never come.
 * - SMS_PROVIDER=log: test mode. Messages are logged (number masked) and
 *   reported as sent, without contacting any provider.
 *
 * A real provider is added by registering an adapter in `providers` below.
 * Its inbound webhook must verify the provider's own signature before calling
 * handleInboundSms in src/lib/fan-list.ts.
 */

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsSendResult>;
}

/** Keeps a texted body to about two SMS segments. */
export const MAX_SMS_LENGTH = 320;

export function maskPhone(phone: string): string {
  return phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : '****';
}

const logProvider: SmsProvider = {
  name: 'log',
  async send(to, body) {
    logger.info('SMS (test mode, not sent)', { to: maskPhone(to), length: body.length });
    return { success: true, messageId: `log_${Date.now().toString(36)}` };
  },
};

const providers: Record<string, SmsProvider> = {
  log: logProvider,
};

/** The configured provider, or null when texts are switched off. */
export function getSmsProvider(env: Record<string, string | undefined> = process.env) {
  const name = env.SMS_PROVIDER?.trim().toLowerCase();
  if (!name) return null;

  const provider = providers[name];
  if (!provider) {
    logger.warn('Unknown SMS_PROVIDER; texts are switched off', { provider: name });
    return null;
  }
  return provider;
}

export function isSmsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return getSmsProvider(env) !== null;
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const provider = getSmsProvider();
  if (!provider) {
    return { success: false, error: 'Text messages are not set up' };
  }
  try {
    return await provider.send(to, body);
  } catch (error) {
    logger.error('SMS send failed', { to: maskPhone(to), provider: provider.name }, error as Error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * A phone number in E.164 form (+15551234567), or null if it isn't one.
 * A 10-digit number, or 11 digits starting with 1, is read as US/Canada.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length > 32) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;

  let e164: string;
  if (hasPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`;
  } else {
    return null;
  }

  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** Carrier-standard keywords. */
const STOP_WORDS = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'REVOKE',
  'OPTOUT',
]);
const HELP_WORDS = new Set(['HELP', 'INFO']);

export type SmsKeyword = 'stop' | 'help' | null;

export function parseSmsKeyword(body: string): SmsKeyword {
  const word = body
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (STOP_WORDS.has(word)) return 'stop';
  if (HELP_WORDS.has(word)) return 'help';
  return null;
}
