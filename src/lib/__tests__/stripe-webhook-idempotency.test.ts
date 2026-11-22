import { prisma } from '@/lib/prisma';
import {
  claimWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  STALE_PROCESSING_MS,
} from '@/lib/stripe-webhook-idempotency';

const events = (prisma as any).stripe_webhook_events;

function uniqueViolation() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

describe('stripe webhook idempotency', () => {
  const now = new Date('2026-11-22T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims a new event', async () => {
    events.create.mockResolvedValue({});

    await expect(claimWebhookEvent('evt_1', 'checkout.session.completed', now)).resolves.toBe(
      'claimed'
    );
    expect(events.create).toHaveBeenCalledWith({
      data: { id: 'evt_1', type: 'checkout.session.completed', status: 'PROCESSING', attempts: 1 },
    });
  });

  it('reports an already processed event as a duplicate', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({ id: 'evt_1', status: 'PROCESSED', updatedAt: now });

    await expect(claimWebhookEvent('evt_1', 'x', now)).resolves.toBe('duplicate');
    expect(events.updateMany).not.toHaveBeenCalled();
  });

  it('does not take over an event another delivery is processing', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({
      id: 'evt_1',
      status: 'PROCESSING',
      updatedAt: new Date(now.getTime() - 1000),
    });

    await expect(claimWebhookEvent('evt_1', 'x', now)).resolves.toBe('in_progress');
    expect(events.updateMany).not.toHaveBeenCalled();
  });

  it('reclaims a failed event for retry', async () => {
    const updatedAt = new Date(now.getTime() - 1000);
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({ id: 'evt_1', status: 'FAILED', updatedAt });
    events.updateMany.mockResolvedValue({ count: 1 });

    await expect(claimWebhookEvent('evt_1', 'x', now)).resolves.toBe('claimed');
    expect(events.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', status: 'FAILED', updatedAt },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    });
  });

  it('reclaims an abandoned (stale) processing claim', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({
      id: 'evt_1',
      status: 'PROCESSING',
      updatedAt: new Date(now.getTime() - STALE_PROCESSING_MS - 1),
    });
    events.updateMany.mockResolvedValue({ count: 1 });

    await expect(claimWebhookEvent('evt_1', 'x', now)).resolves.toBe('claimed');
  });

  it('loses the race when another delivery reclaims first', async () => {
    events.create.mockRejectedValue(uniqueViolation());
    events.findUnique.mockResolvedValue({ id: 'evt_1', status: 'FAILED', updatedAt: now });
    events.updateMany.mockResolvedValue({ count: 0 });

    await expect(claimWebhookEvent('evt_1', 'x', now)).resolves.toBe('in_progress');
  });

  it('rethrows database errors that are not a duplicate key', async () => {
    events.create.mockRejectedValue(new Error('connection lost'));

    await expect(claimWebhookEvent('evt_1', 'x', now)).rejects.toThrow('connection lost');
  });

  it('marks events processed and failed', async () => {
    events.update.mockResolvedValue({});

    await markWebhookEventProcessed('evt_1');
    expect(events.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'PROCESSED', processedAt: expect.any(Date), lastError: null },
    });

    await markWebhookEventFailed('evt_1', new Error('x'.repeat(2000)));
    const failedCall = events.update.mock.calls[1][0];
    expect(failedCall.data.status).toBe('FAILED');
    expect(failedCall.data.lastError).toHaveLength(1000);
  });
});
