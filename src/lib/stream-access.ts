import { prisma } from '@/lib/prisma';

/**
 * Who may watch a live stream or listening party, and use its chat. One rule
 * for every route and the stream socket:
 *
 * - The artist who owns the stream always may.
 * - A ticketed stream (requiresPayment with a price) needs a paid ticket.
 *   Members of a tier the stream names get in without one. This holds even
 *   when the stream is marked public, so a ticket can't be skipped.
 * - Otherwise a public stream is open to anyone (signed out too, for chat), and
 *   a private one to signed-in members of the tiers it names (or anyone
 *   signed in, when it names none).
 */

export interface StreamAccessFields {
  id: string;
  artistId: string;
  isPublic: boolean;
  tierIds: string | null;
  requiresPayment: boolean;
  paymentAmount: { toString(): string } | number | null;
}

/** Selects the fields canViewStream needs. */
export const STREAM_ACCESS_SELECT = {
  id: true,
  artistId: true,
  isPublic: true,
  tierIds: true,
  requiresPayment: true,
  paymentAmount: true,
} as const;

export function parseTierIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function isTicketed(stream: Pick<StreamAccessFields, 'requiresPayment' | 'paymentAmount'>) {
  return stream.requiresPayment && Number(stream.paymentAmount?.toString() ?? 0) > 0;
}

export async function hasStreamTicket(fanId: string, streamId: string): Promise<boolean> {
  const ticket = await prisma.purchases.findFirst({
    where: { fanId, itemType: 'LIVE_STREAM_TICKET', itemId: streamId, status: 'PAID' },
    select: { id: true },
  });
  return Boolean(ticket);
}

async function isMemberOf(fanId: string, tierIds: string[]): Promise<boolean> {
  if (tierIds.length === 0) return false;
  const subscription = await prisma.subscriptions.findFirst({
    where: { fanId, tierId: { in: tierIds }, status: 'ACTIVE' },
    select: { id: true },
  });
  return Boolean(subscription);
}

export async function canViewStream(
  userId: string | null | undefined,
  stream: StreamAccessFields
): Promise<boolean> {
  if (!userId) return stream.isPublic && !isTicketed(stream);
  if (stream.artistId === userId) return true;

  const tierIds = parseTierIds(stream.tierIds);

  if (isTicketed(stream)) {
    if (await hasStreamTicket(userId, stream.id)) return true;
    return isMemberOf(userId, tierIds);
  }

  if (stream.isPublic || tierIds.length === 0) return true;
  return isMemberOf(userId, tierIds);
}

export const MIN_TICKET_PRICE = 0.5;
export const MAX_TICKET_PRICE = 1000;

/**
 * Why a ticket setting can't be saved, or null when it can. A ticketed
 * stream needs a price between 0.50 and 1,000 dollars, in whole cents.
 */
export function ticketPriceError(
  requiresPayment: boolean,
  paymentAmount: { toString(): string } | number | null | undefined
): string | null {
  if (!requiresPayment) return null;
  const price = Number(paymentAmount?.toString() ?? NaN);
  if (!Number.isFinite(price) || price < MIN_TICKET_PRICE || price > MAX_TICKET_PRICE) {
    return 'A ticket price must be between 0.50 and 1000';
  }
  if (Math.abs(Math.round(price * 100) - price * 100) > 1e-6) {
    return 'A ticket price must be in whole cents';
  }
  return null;
}
