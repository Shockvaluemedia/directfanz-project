jest.mock('@/lib/email-service', () => ({
  emailService: { sendEmail: jest.fn() },
}));

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email-service';
import { buildReminderEmail, getParty, sendPartyReminders } from '@/lib/parties';

const db = prisma as any;
const sendEmail = emailService.sendEmail as jest.Mock;
const now = new Date('2026-12-05T19:15:00Z');

const partyRow = {
  id: 'stream_1',
  artistId: 'artist_1',
  isPublic: true,
  tierIds: '[]',
  requiresPayment: true,
  paymentAmount: { toString: () => '8' },
  title: 'Release night',
  description: 'First listen',
  status: 'SCHEDULED',
  scheduledAt: new Date('2026-12-05T20:00:00Z'),
  thumbnailUrl: null,
  users: { id: 'artist_1', displayName: 'Nahvee' },
};

beforeEach(() => {
  jest.clearAllMocks();
  db.purchases.findFirst.mockResolvedValue(null);
  db.subscriptions.findFirst.mockResolvedValue(null);
  db.purchases.updateMany.mockResolvedValue({ count: 1 });
  sendEmail.mockResolvedValue({ success: true });
});

describe('party details', () => {
  it('shows the public details and whether the fan holds a ticket', async () => {
    db.live_streams.findUnique.mockResolvedValue(partyRow);
    db.purchases.findFirst.mockResolvedValue({ id: 'pur_1' });

    const party = await getParty('stream_1', 'fan_1');

    expect(party).toEqual({
      id: 'stream_1',
      title: 'Release night',
      description: 'First listen',
      status: 'SCHEDULED',
      scheduledAt: '2026-12-05T20:00:00.000Z',
      thumbnailUrl: null,
      price: '8.00',
      currency: 'usd',
      artist: { id: 'artist_1', displayName: 'Nahvee' },
      hasTicket: true,
      canWatch: true,
    });
    // Only these fields are read, so the stream key can't leak.
    expect(db.live_streams.findUnique.mock.calls[0][0].select).not.toHaveProperty('streamKey');
  });

  it('signed out, or without a ticket, the fan can see it but not watch', async () => {
    db.live_streams.findUnique.mockResolvedValue(partyRow);
    await expect(getParty('stream_1', null)).resolves.toMatchObject({
      hasTicket: false,
      canWatch: false,
    });
    await expect(getParty('stream_1', 'fan_1')).resolves.toMatchObject({ canWatch: false });
  });

  it('is not found for a stream that sells no tickets', async () => {
    db.live_streams.findUnique.mockResolvedValue({ ...partyRow, requiresPayment: false });
    await expect(getParty('stream_1', 'fan_1')).resolves.toBeNull();
  });
});

describe('starting-soon reminders', () => {
  beforeEach(() => {
    db.live_streams.findMany.mockResolvedValue([partyRow]);
    db.purchases.findMany.mockResolvedValue([
      { id: 'pur_1', users: { email: 'a@example.com' } },
      { id: 'pur_2', users: { email: 'b@example.com' } },
    ]);
  });

  it('emails each ticket holder of a party starting within the hour, once', async () => {
    const result = await sendPartyReminders('https://app.test', now);

    expect(result).toEqual({ parties: 1, sent: 2, failed: 0 });
    const window = db.live_streams.findMany.mock.calls[0][0].where.scheduledAt;
    expect(window.gt).toEqual(now);
    expect(window.lte).toEqual(new Date('2026-12-05T20:15:00Z'));
    expect(db.purchases.findMany.mock.calls[0][0].where).toMatchObject({
      itemType: 'LIVE_STREAM_TICKET',
      itemId: 'stream_1',
      status: 'PAID',
      reminderSentAt: null,
    });
    expect(db.purchases.updateMany).toHaveBeenCalledWith({
      where: { id: 'pur_1', reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'a@example.com',
      subject: 'Starting soon: Nahvee, Release night',
    });
    expect(sendEmail.mock.calls[0][0].text).toContain('https://app.test/stream/stream_1');
  });

  it('skips a ticket another run already claimed', async () => {
    db.purchases.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await sendPartyReminders('https://app.test', now);

    expect(result.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('gives a failed email back so the next run tries again', async () => {
    sendEmail.mockResolvedValueOnce({ success: false });

    const result = await sendPartyReminders('https://app.test', now);

    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(db.purchases.updateMany).toHaveBeenCalledWith({
      where: { id: 'pur_1', reminderSentAt: now },
      data: { reminderSentAt: null },
    });
  });

  it('escapes the artist name and title in the email', () => {
    const email = buildReminderEmail(
      { title: '<b>x</b>', artistName: 'A & B', scheduledAt: partyRow.scheduledAt },
      'https://app.test/stream/stream_1'
    );
    expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(email.html).toContain('A &amp; B');
    expect(email.text).toContain('Sat, 05 Dec 2026 20:00:00 UTC');
  });
});
