import crypto from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email-service';
import { isSmsEnabled, MAX_SMS_LENGTH, normalizePhone, parseSmsKeyword, sendSms } from '@/lib/sms';

/**
 * The artist-owned fan list. Fans opt in to hear from an artist about drops
 * and listening parties, by email and, separately, by text message. The
 * artist can see and export the list and send announcements to it. Every
 * email carries a one-click unsubscribe link; every text ends with "Reply
 * STOP to opt out", and STOP from a number opts it out of every list.
 */

export const FAN_LIST_SOURCES = ['SIGNUP', 'PURCHASE'] as const;
export type FanListSource = (typeof FAN_LIST_SOURCES)[number];

/** Announcements an artist may send in any rolling 24 hours. */
export const MAX_ANNOUNCEMENTS_PER_DAY = 3;
/** Messages sent at once while delivering an announcement. */
const SEND_CONCURRENCY = 10;
const PAGE_SIZE_MAX = 200;

const SMS_STOP_SUFFIX = ' Reply STOP to opt out.';
export const SMS_STOP_REPLY =
  "You're unsubscribed from DirectFanz texts and won't get any more. Reply HELP for help.";
export const SMS_HELP_REPLY =
  'DirectFanz: texts about drops and listening parties from artists you joined. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out.';

export class FanListError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'FanListError';
  }
}

/** The words a fan agrees to when opting in to texts; stored with their yes. */
export function smsConsentText(artistName: string): string {
  return (
    `Yes, text me about ${artistName}'s drops and listening parties at this number. ` +
    'Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. ' +
    'Consent is not a condition of purchase.'
  );
}

const emailSubscribed = { emailConsentedAt: { not: null }, emailUnsubscribedAt: null };
const smsSubscribed = {
  smsConsentedAt: { not: null },
  smsUnsubscribedAt: null,
  smsPhone: { not: null },
};

function isEmailSubscribed(m: { emailConsentedAt: Date | null; emailUnsubscribedAt: Date | null }) {
  return Boolean(m.emailConsentedAt && !m.emailUnsubscribedAt);
}

function isSmsSubscribed(m: {
  smsConsentedAt: Date | null;
  smsUnsubscribedAt: Date | null;
  smsPhone: string | null;
}) {
  return Boolean(m.smsConsentedAt && !m.smsUnsubscribedAt && m.smsPhone);
}

function newUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

async function findArtist(artistId: string) {
  const artist = await prisma.users.findUnique({
    where: { id: artistId },
    select: { id: true, role: true, displayName: true },
  });
  if (!artist || artist.role !== 'ARTIST') {
    throw new FanListError('Artist not found', 404);
  }
  return artist;
}

/** Joining either channel also follows the artist. */
async function follow(fanId: string, artistId: string) {
  await prisma.follows.upsert({
    where: { followerId_followedId: { followerId: fanId, followedId: artistId } },
    create: { followerId: fanId, followedId: artistId },
    update: {},
  });
}

/**
 * Upsert the member row with a channel's consent fields. Creates the row
 * (with its email unsubscribe token) the first time a fan joins either way.
 */
interface ConsentFields {
  emailConsentedAt?: Date;
  emailUnsubscribedAt?: null;
  smsPhone?: string;
  smsConsentedAt?: Date;
  smsConsentText?: string;
  smsUnsubscribedAt?: null;
}

async function upsertMember(
  artistId: string,
  fanId: string,
  source: FanListSource,
  consent: ConsentFields
) {
  return prisma.fan_list_members.upsert({
    where: { artistId_fanId: { artistId, fanId } },
    create: {
      id: crypto.randomUUID(),
      artistId,
      fanId,
      source,
      unsubscribeToken: newUnsubscribeToken(),
      ...consent,
    },
    update: consent,
  });
}

/** Email opt-in. Joining again after leaving re-subscribes. */
export async function joinFanList(
  artistId: string,
  fanId: string,
  source: FanListSource,
  now: Date = new Date()
) {
  if (artistId === fanId) {
    throw new FanListError('You cannot join your own fan list', 400);
  }
  await findArtist(artistId);

  const member = await upsertMember(artistId, fanId, source, {
    emailConsentedAt: now,
    emailUnsubscribedAt: null,
  });
  await follow(fanId, artistId);
  return member;
}

/**
 * Text opt-in, separate from email. Refused while texts are switched off, so
 * no fan is told they'll get texts that never come. Sends a confirmation text.
 */
export async function optInToSms(
  artistId: string,
  fanId: string,
  phoneInput: string,
  now: Date = new Date()
) {
  if (!isSmsEnabled()) {
    throw new FanListError('Text messages are not available yet', 503);
  }
  if (artistId === fanId) {
    throw new FanListError('You cannot join your own fan list', 400);
  }
  const phone = normalizePhone(phoneInput);
  if (!phone) {
    throw new FanListError('Enter a valid mobile number', 400);
  }

  const artist = await findArtist(artistId);
  const member = await upsertMember(artistId, fanId, 'SIGNUP', {
    smsPhone: phone,
    smsConsentedAt: now,
    smsConsentText: smsConsentText(artist.displayName),
    smsUnsubscribedAt: null,
  });
  await follow(fanId, artistId);

  const confirmation = await sendSms(
    phone,
    `You're on ${artist.displayName}'s text list on DirectFanz. Msg frequency varies. ` +
      'Msg & data rates may apply. Reply HELP for help, STOP to opt out.'
  );
  if (!confirmation.success) {
    console.error('SMS opt-in confirmation was not sent:', confirmation.error);
  }

  return member;
}

export async function optOutOfSms(
  artistId: string,
  fanId: string,
  now: Date = new Date()
): Promise<boolean> {
  const left = await prisma.fan_list_members.updateMany({
    where: { artistId, fanId, smsUnsubscribedAt: null, smsConsentedAt: { not: null } },
    data: { smsUnsubscribedAt: now },
  });
  return left.count > 0;
}

/** Leave the list entirely: no more email and no more texts. */
export async function leaveFanList(
  artistId: string,
  fanId: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.fan_list_members.updateMany({
    where: { artistId, fanId, emailUnsubscribedAt: null, emailConsentedAt: { not: null } },
    data: { emailUnsubscribedAt: now },
  });
  await optOutOfSms(artistId, fanId, now);
}

export async function getFanListStatus(artistId: string, fanId: string) {
  const member = await prisma.fan_list_members.findUnique({
    where: { artistId_fanId: { artistId, fanId } },
  });
  return {
    email: Boolean(member && isEmailSubscribed(member)),
    sms: Boolean(member && isSmsSubscribed(member)),
  };
}

/**
 * Unsubscribe from the link in an email, without signing in. Stops email only;
 * texts are stopped by replying STOP. Returns the artist's name when the token
 * is valid (already unsubscribed counts too).
 */
export async function unsubscribeByToken(
  token: string,
  now: Date = new Date()
): Promise<{ artistName: string } | null> {
  if (!token || token.length > 200) return null;

  const member = await prisma.fan_list_members.findUnique({
    where: { unsubscribeToken: token },
    include: { artist: { select: { displayName: true } } },
  });
  if (!member) return null;

  if (!member.emailUnsubscribedAt) {
    await prisma.fan_list_members.updateMany({
      where: { id: member.id, emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: now },
    });
  }

  return { artistName: member.artist.displayName };
}

/**
 * A text a fan sent to the DirectFanz number. STOP opts the number out of
 * every artist's text list; HELP gets the help message. Returns the reply to
 * send back, or null for anything else. The provider adapter verifies the
 * request came from the provider before calling this.
 */
export async function handleInboundSms(
  fromInput: string,
  body: string,
  now: Date = new Date()
): Promise<{ action: 'stop' | 'help' | 'none'; reply: string | null }> {
  const keyword = parseSmsKeyword(body);
  if (keyword === 'help') {
    return { action: 'help', reply: SMS_HELP_REPLY };
  }
  if (keyword !== 'stop') {
    return { action: 'none', reply: null };
  }

  const phone = normalizePhone(fromInput);
  if (phone) {
    await prisma.fan_list_members.updateMany({
      where: { smsPhone: phone, smsUnsubscribedAt: null },
      data: { smsUnsubscribedAt: now },
    });
  }
  return { action: 'stop', reply: SMS_STOP_REPLY };
}

export interface FanListEntry {
  fanId: string;
  displayName: string;
  /** Present only while the fan gets email. */
  email: string | null;
  /** Present only while the fan gets texts. */
  phone: string | null;
  source: string;
  joinedAt: Date;
}

const subscribedOnAnyChannel = (artistId: string) => ({
  artistId,
  OR: [emailSubscribed, smsSubscribed],
});

type MemberWithFan = Prisma.fan_list_membersGetPayload<{
  include: { fan: { select: { displayName: true; email: true } } };
}>;

function toEntry(row: MemberWithFan): FanListEntry {
  return {
    fanId: row.fanId,
    displayName: row.fan.displayName,
    email: isEmailSubscribed(row) ? row.fan.email : null,
    phone: isSmsSubscribed(row) ? row.smsPhone : null,
    source: row.source,
    joinedAt: row.createdAt,
  };
}

/** Fans who get email or texts, oldest first, a page at a time. */
export async function listFanListMembers(
  artistId: string,
  options: { cursor?: string; limit?: number } = {}
): Promise<{ members: FanListEntry[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), PAGE_SIZE_MAX);
  const where = subscribedOnAnyChannel(artistId);

  const [rows, total] = await Promise.all([
    prisma.fan_list_members.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: { fan: { select: { displayName: true, email: true } } },
    }),
    prisma.fan_list_members.count({ where }),
  ]);

  const page = rows.slice(0, limit);
  return {
    members: page.map(toEntry),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    total,
  };
}

async function allSubscribedMembers(artistId: string) {
  return prisma.fan_list_members.findMany({
    where: subscribedOnAnyChannel(artistId),
    orderBy: { createdAt: 'asc' },
    include: { fan: { select: { displayName: true, email: true } } },
  });
}

/**
 * A spreadsheet cell. Quotes every value, and neutralises text a spreadsheet
 * would run as a formula (a display name like "=HYPERLINK(...)").
 */
export function csvCell(value: string): string {
  // A bare E.164 phone number (+ then digits) can't run as a formula.
  const isPhone = /^\+\d{8,15}$/.test(value);
  const safe = !isPhone && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function exportFanListCsv(artistId: string): Promise<string> {
  const entries = (await allSubscribedMembers(artistId)).map(toEntry);
  const lines = [
    ['email', 'phone', 'name', 'source', 'joined_at'].join(','),
    ...entries.map(e =>
      [e.email ?? '', e.phone ?? '', e.displayName, e.source, e.joinedAt.toISOString()]
        .map(csvCell)
        .join(',')
    ),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export const announcementSchema = z
  .object({
    subject: z.string().trim().min(1).max(150),
    message: z.string().trim().min(1).max(5000),
    /** Also text fans who opted in to texts. */
    smsMessage: z
      .string()
      .trim()
      .min(1)
      .max(MAX_SMS_LENGTH - 80)
      .optional(),
  })
  .strict();

export type AnnouncementInput = z.infer<typeof announcementSchema>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/fan-list/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The email one fan receives. The artist's text is shown as plain text. */
export function buildAnnouncementEmail(
  artistName: string,
  input: Pick<AnnouncementInput, 'subject' | 'message'>,
  unsubscribeLink: string
) {
  const footer = `You're getting this because you joined ${artistName}'s fan list.`;
  const text = `${input.message}\n\n--\n${footer}\nUnsubscribe: ${unsubscribeLink}\n`;
  const html = `<div style="font-family: sans-serif; line-height: 1.5;">
<p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
<hr style="border: none; border-top: 1px solid #ddd;" />
<p style="font-size: 12px; color: #666;">${escapeHtml(footer)}
<a href="${escapeHtml(unsubscribeLink)}">Unsubscribe</a></p>
</div>`;

  return {
    subject: input.subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeLink}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/** The text one fan receives: who it's from, the message, how to stop. */
export function buildAnnouncementSms(artistName: string, smsMessage: string): string {
  return `${artistName}: ${smsMessage}${SMS_STOP_SUFFIX}`.slice(0, MAX_SMS_LENGTH);
}

async function deliverInBatches<T>(
  items: T[],
  send: (item: T) => Promise<{ success: boolean }>
): Promise<number> {
  let failed = 0;
  for (let i = 0; i < items.length; i += SEND_CONCURRENCY) {
    const results = await Promise.all(
      items.slice(i, i + SEND_CONCURRENCY).map(item => send(item).catch(() => ({ success: false })))
    );
    failed += results.filter(r => !r.success).length;
  }
  return failed;
}

export interface AnnouncementResult {
  id: string;
  recipientCount: number;
  failedCount: number;
  smsRecipientCount: number;
  smsFailedCount: number;
}

/**
 * Email an announcement to every fan who gets email, and text it to every fan
 * who gets texts when smsMessage is given. Limited to MAX_ANNOUNCEMENTS_PER_DAY
 * per artist.
 */
export async function sendAnnouncement(
  artistId: string,
  input: AnnouncementInput,
  baseUrl: string,
  now: Date = new Date()
): Promise<AnnouncementResult> {
  if (input.smsMessage && !isSmsEnabled()) {
    throw new FanListError('Text messages are not available yet', 503);
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = await prisma.fan_list_announcements.count({
    where: { artistId, createdAt: { gte: since } },
  });
  if (recent >= MAX_ANNOUNCEMENTS_PER_DAY) {
    throw new FanListError(
      `You can send up to ${MAX_ANNOUNCEMENTS_PER_DAY} announcements a day`,
      429
    );
  }

  const artist = await prisma.users.findUnique({
    where: { id: artistId },
    select: { displayName: true },
  });
  if (!artist) {
    throw new FanListError('Artist not found', 404);
  }

  const members = await allSubscribedMembers(artistId);
  const emailTo = members.filter(isEmailSubscribed);
  const smsTo = input.smsMessage ? members.filter(isSmsSubscribed) : [];
  if (emailTo.length === 0 && smsTo.length === 0) {
    throw new FanListError('Your fan list has no subscribers yet', 400);
  }

  // Record the send before delivering, so a retry after a timeout counts
  // toward the daily limit instead of messaging everyone again unchecked.
  const id = crypto.randomUUID();
  await prisma.fan_list_announcements.create({
    data: {
      id,
      artistId,
      subject: input.subject,
      body: input.message,
      smsBody: input.smsMessage ?? null,
    },
  });

  const failedCount = await deliverInBatches(emailTo, member =>
    emailService.sendEmail({
      to: member.fan.email,
      ...buildAnnouncementEmail(
        artist.displayName,
        input,
        unsubscribeUrl(baseUrl, member.unsubscribeToken)
      ),
      tags: ['fan-list-announcement'],
    })
  );

  const smsText = input.smsMessage
    ? buildAnnouncementSms(artist.displayName, input.smsMessage)
    : '';
  const smsFailedCount = await deliverInBatches(smsTo, member =>
    sendSms(member.smsPhone as string, smsText)
  );

  const result = {
    recipientCount: emailTo.length - failedCount,
    failedCount,
    smsRecipientCount: smsTo.length - smsFailedCount,
    smsFailedCount,
  };
  await prisma.fan_list_announcements.update({ where: { id }, data: result });

  return { id, ...result };
}
