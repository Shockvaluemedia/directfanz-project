import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Stripe delivers webhooks at least once, so the same event can arrive more
 * than once (retries, network replays, manual resends). Every event is claimed
 * in `stripe_webhook_events` by its Stripe event id before it is applied, so a
 * redelivered event is acknowledged without being applied twice.
 *
 * - First delivery: a PROCESSING row is created and the handler runs.
 * - Already PROCESSED: acknowledged as a duplicate, handler skipped.
 * - Still PROCESSING (another delivery is mid-flight): not applied; the caller
 *   answers non-2xx so Stripe retries later.
 * - FAILED, or PROCESSING but stale (a crashed worker): reclaimed and retried.
 */

export type WebhookClaimResult = 'claimed' | 'duplicate' | 'in_progress';

/** A PROCESSING claim older than this is treated as abandoned and reclaimed. */
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

const MAX_ERROR_LENGTH = 1000;

function isUniqueViolation(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002')
  );
}

export async function claimWebhookEvent(
  eventId: string,
  eventType: string,
  now: Date = new Date()
): Promise<WebhookClaimResult> {
  try {
    await prisma.stripe_webhook_events.create({
      data: { id: eventId, type: eventType, status: 'PROCESSING', attempts: 1 },
    });
    return 'claimed';
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }

  const existing = await prisma.stripe_webhook_events.findUnique({ where: { id: eventId } });

  if (!existing) {
    // The row vanished between the insert conflict and the read; let Stripe retry.
    return 'in_progress';
  }

  if (existing.status === 'PROCESSED') {
    return 'duplicate';
  }

  const isStale = now.getTime() - existing.updatedAt.getTime() > STALE_PROCESSING_MS;
  if (existing.status === 'PROCESSING' && !isStale) {
    return 'in_progress';
  }

  // FAILED, or an abandoned PROCESSING claim: take it over atomically. The
  // status + updatedAt guard means only one concurrent delivery wins.
  const reclaimed = await prisma.stripe_webhook_events.updateMany({
    where: { id: eventId, status: existing.status, updatedAt: existing.updatedAt },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
  });

  return reclaimed.count === 1 ? 'claimed' : 'in_progress';
}

export async function markWebhookEventProcessed(eventId: string): Promise<void> {
  await prisma.stripe_webhook_events.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
  });
}

export async function markWebhookEventFailed(eventId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.stripe_webhook_events.update({
    where: { id: eventId },
    data: { status: 'FAILED', lastError: message.slice(0, MAX_ERROR_LENGTH) },
  });
}
