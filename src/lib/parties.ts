import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email-service';
import {
  canViewStream,
  hasStreamTicket,
  isTicketed,
  STREAM_ACCESS_SELECT,
} from '@/lib/stream-access';

/**
 * Listening parties: scheduled live streams sold by ticket. The ticket is a
 * one-time purchase (item type LIVE_STREAM_TICKET, see purchases.ts), entry is
 * checked by canViewStream, and ticket holders get a "starting soon" email.
 */

/** How far ahead of the start the reminder goes out. */
export const REMINDER_LEAD_MS = 60 * 60 * 1000;
const REMINDER_BATCH = 200;

const UPCOMING_STATUSES = ['SCHEDULED', 'LIVE'];

const partySelect = {
  ...STREAM_ACCESS_SELECT,
  title: true,
  description: true,
  status: true,
  scheduledAt: true,
  thumbnailUrl: true,
  users: { select: { id: true, displayName: true } },
} as const;

type PartyRow = {
  id: string;
  artistId: string;
  title: string;
  description: string | null;
  status: string;
  scheduledAt: Date | null;
  thumbnailUrl: string | null;
  paymentAmount: { toString(): string } | number | null;
  users: { id: string; displayName: string };
};

export interface PublicParty {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  price: string;
  currency: 'usd';
  artist: { id: string; displayName: string };
}

/** What anyone may see about a party: no stream key, viewers or chat. */
export function toPublicParty(row: PartyRow): PublicParty {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    thumbnailUrl: row.thumbnailUrl,
    price: Number(row.paymentAmount?.toString() ?? 0).toFixed(2),
    currency: 'usd',
    artist: { id: row.users.id, displayName: row.users.displayName },
  };
}

/** One or more artists' ticketed parties that are coming up or live, soonest first. */
export async function listUpcomingParties(artistId: string | string[]): Promise<PublicParty[]> {
  const rows = await prisma.live_streams.findMany({
    where: {
      artistId: Array.isArray(artistId) ? { in: artistId } : artistId,
      requiresPayment: true,
      paymentAmount: { gt: 0 },
      status: { in: UPCOMING_STATUSES },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: partySelect,
  });
  return rows.map(toPublicParty);
}

/**
 * One party, plus whether the signed-in fan holds a ticket and may watch.
 * Null when the stream isn't a ticketed party.
 */
export async function getParty(
  streamId: string,
  userId: string | null | undefined
): Promise<(PublicParty & { hasTicket: boolean; canWatch: boolean }) | null> {
  const row = await prisma.live_streams.findUnique({
    where: { id: streamId },
    select: partySelect,
  });
  if (!row || !isTicketed(row)) return null;

  const [hasTicket, canWatch] = userId
    ? await Promise.all([hasStreamTicket(userId, row.id), canViewStream(userId, row)])
    : [false, false];

  return { ...toPublicParty(row), hasTicket, canWatch };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReminderEmail(
  party: { title: string; artistName: string; scheduledAt: Date },
  watchUrl: string
) {
  const when = party.scheduledAt.toUTCString().replace(' GMT', ' UTC');
  const subject = `Starting soon: ${party.artistName}, ${party.title}`;
  const text =
    `Your ticket for ${party.artistName}'s listening party "${party.title}" is ready.\n\n` +
    `It starts at ${when}.\n\nJoin here: ${watchUrl}\n`;
  const html =
    `<p>Your ticket for ${escapeHtml(party.artistName)}'s listening party ` +
    `<strong>${escapeHtml(party.title)}</strong> is ready.</p>` +
    `<p>It starts at ${escapeHtml(when)}.</p>` +
    `<p><a href="${escapeHtml(watchUrl)}">Join the party</a></p>`;
  return { subject, text, html };
}

export interface ReminderRunResult {
  parties: number;
  sent: number;
  failed: number;
}

/**
 * Email every ticket holder of a party starting within the next hour, once.
 * Called by /api/cron/party-reminders. A ticket is claimed before its email
 * is sent, so overlapping runs don't send twice; a failed send is released so
 * the next run tries again.
 */
export async function sendPartyReminders(
  baseUrl: string,
  now: Date = new Date()
): Promise<ReminderRunResult> {
  const parties = await prisma.live_streams.findMany({
    where: {
      status: 'SCHEDULED',
      requiresPayment: true,
      scheduledAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
    },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      users: { select: { displayName: true } },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const party of parties) {
    const tickets = await prisma.purchases.findMany({
      where: {
        itemType: 'LIVE_STREAM_TICKET',
        itemId: party.id,
        status: 'PAID',
        reminderSentAt: null,
      },
      select: { id: true, users: { select: { email: true } } },
      take: REMINDER_BATCH,
    });

    const email = buildReminderEmail(
      { title: party.title, artistName: party.users.displayName, scheduledAt: party.scheduledAt! },
      `${baseUrl}/stream/${party.id}`
    );

    for (const ticket of tickets) {
      const claimed = await prisma.purchases.updateMany({
        where: { id: ticket.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claimed.count !== 1 || !ticket.users?.email) continue;

      const result = await emailService.sendEmail({ to: ticket.users.email, ...email });
      if (result.success) {
        sent += 1;
      } else {
        failed += 1;
        await prisma.purchases.updateMany({
          where: { id: ticket.id, reminderSentAt: now },
          data: { reminderSentAt: null },
        });
      }
    }
  }

  return { parties: parties.length, sent, failed };
}
