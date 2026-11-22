jest.mock('@/lib/email-service', () => ({
  emailService: { sendEmail: jest.fn() },
}));
jest.mock('@/lib/marketing-events', () => ({
  emitMarketingEvent: jest.fn(),
  emitMarketingEvents: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email-service';
import { emitMarketingEvent, emitMarketingEvents } from '@/lib/marketing-events';
import {
  buildAnnouncementEmail,
  buildAnnouncementSms,
  csvCell,
  exportFanListCsv,
  handleInboundSms,
  joinFanList,
  leaveFanList,
  MAX_ANNOUNCEMENTS_PER_DAY,
  optInToSms,
  sendAnnouncement,
  SMS_HELP_REPLY,
  SMS_STOP_REPLY,
  unsubscribeByToken,
} from '@/lib/fan-list';

const db = prisma as any;
const sendEmail = emailService.sendEmail as jest.Mock;
const now = new Date('2026-12-01T12:00:00Z');

const artist = { id: 'artist_1', role: 'ARTIST', displayName: 'Nahvee' };

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm_1',
    artistId: 'artist_1',
    fanId: 'fan_1',
    source: 'SIGNUP',
    emailConsentedAt: now,
    emailUnsubscribedAt: null,
    smsPhone: null,
    smsConsentedAt: null,
    smsConsentText: null,
    smsUnsubscribedAt: null,
    unsubscribeToken: 'tok_1',
    createdAt: now,
    fan: { displayName: 'Fan One', email: 'fan1@example.com' },
    ...overrides,
  };
}

const originalProvider = process.env.SMS_PROVIDER;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SMS_PROVIDER;
  db.users.findUnique.mockResolvedValue(artist);
  db.fan_list_members.upsert.mockResolvedValue(member());
  db.fan_list_members.updateMany.mockResolvedValue({ count: 1 });
  db.follows.upsert.mockResolvedValue({});
  db.follows.findUnique.mockResolvedValue(null);
  db.fan_list_members.findUnique.mockResolvedValue(null);
  sendEmail.mockResolvedValue({ success: true });
});

afterAll(() => {
  if (originalProvider === undefined) delete process.env.SMS_PROVIDER;
  else process.env.SMS_PROVIDER = originalProvider;
});

describe('joining and leaving', () => {
  it('records email consent and follows the artist', async () => {
    await joinFanList('artist_1', 'fan_1', 'SIGNUP', now);

    const call = db.fan_list_members.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ artistId_fanId: { artistId: 'artist_1', fanId: 'fan_1' } });
    expect(call.create).toMatchObject({ source: 'SIGNUP', emailConsentedAt: now });
    expect(call.create.unsubscribeToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    // Joining again after leaving re-subscribes, but never touches texts.
    expect(call.update).toEqual({ emailConsentedAt: now, emailUnsubscribedAt: null });
    expect(db.follows.upsert).toHaveBeenCalled();
  });

  it('refuses an artist joining their own list, or a user who is not an artist', async () => {
    await expect(joinFanList('artist_1', 'artist_1', 'SIGNUP')).rejects.toMatchObject({
      status: 400,
    });
    db.users.findUnique.mockResolvedValue({ ...artist, role: 'FAN' });
    await expect(joinFanList('artist_1', 'fan_1', 'SIGNUP')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('leaving stops both email and texts', async () => {
    await leaveFanList('artist_1', 'fan_1', now);

    expect(db.fan_list_members.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { emailUnsubscribedAt: now } })
    );
    expect(db.fan_list_members.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { smsUnsubscribedAt: now } })
    );
  });

  it('the email link unsubscribes email only, and unknown tokens do nothing', async () => {
    db.fan_list_members.findUnique.mockResolvedValue({
      ...member(),
      artist: { displayName: 'Nahvee' },
    });

    await expect(unsubscribeByToken('tok_1', now)).resolves.toEqual({ artistName: 'Nahvee' });
    expect(db.fan_list_members.updateMany).toHaveBeenCalledWith({
      where: { id: 'm_1', emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: now },
    });

    db.fan_list_members.findUnique.mockResolvedValue(null);
    await expect(unsubscribeByToken('nope')).resolves.toBeNull();
  });
});

describe('text opt-in', () => {
  it('is refused while no text provider is set up', async () => {
    await expect(optInToSms('artist_1', 'fan_1', '312 555 0100')).rejects.toMatchObject({
      status: 503,
    });
    expect(db.fan_list_members.upsert).not.toHaveBeenCalled();
  });

  it('stores the number, the time and the exact consent words, then confirms by text', async () => {
    process.env.SMS_PROVIDER = 'log';

    await optInToSms('artist_1', 'fan_1', '(312) 555-0100', now);

    const call = db.fan_list_members.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({
      smsPhone: '+13125550100',
      smsConsentedAt: now,
      smsUnsubscribedAt: null,
    });
    expect(call.update.smsConsentText).toContain("Nahvee's drops and listening parties");
    expect(call.update.smsConsentText).toContain('Reply STOP to cancel');
    // A text opt-in says nothing about email.
    expect(call.update).not.toHaveProperty('emailConsentedAt');
  });

  it('refuses a number it cannot read', async () => {
    process.env.SMS_PROVIDER = 'log';
    await expect(optInToSms('artist_1', 'fan_1', '12345')).rejects.toMatchObject({ status: 400 });
  });
});

describe('inbound texts', () => {
  it('STOP opts the number out of every artist list', async () => {
    const result = await handleInboundSms('+1 312 555 0100', ' stop ', now);

    expect(result).toEqual({ action: 'stop', reply: SMS_STOP_REPLY });
    expect(db.fan_list_members.updateMany).toHaveBeenCalledWith({
      where: { smsPhone: '+13125550100', smsUnsubscribedAt: null },
      data: { smsUnsubscribedAt: now },
    });
  });

  it('HELP answers without changing anything, other texts are ignored', async () => {
    await expect(handleInboundSms('+13125550100', 'Help')).resolves.toEqual({
      action: 'help',
      reply: SMS_HELP_REPLY,
    });
    await expect(handleInboundSms('+13125550100', 'love the single')).resolves.toEqual({
      action: 'none',
      reply: null,
    });
    expect(db.fan_list_members.updateMany).not.toHaveBeenCalled();
  });
});

describe('marketing feed', () => {
  const emit = emitMarketingEvent as jest.Mock;
  const types = () => emit.mock.calls.map(call => call[0].type);

  it('a first join reports the follow and the email opt-in', async () => {
    await joinFanList('artist_1', 'fan_1', 'PURCHASE', now);

    expect(types()).toEqual(['fan.followed', 'email.opted_in']);
    expect(emit.mock.calls[1][0]).toMatchObject({ data: { source: 'PURCHASE' } });
  });

  it('joining again while still subscribed and following reports nothing', async () => {
    db.follows.findUnique.mockResolvedValue({ followerId: 'fan_1' });
    db.fan_list_members.findUnique.mockResolvedValue(member());

    await joinFanList('artist_1', 'fan_1', 'SIGNUP', now);

    expect(emit).not.toHaveBeenCalled();
  });

  it('a text opt-in is reported', async () => {
    process.env.SMS_PROVIDER = 'log';
    db.follows.findUnique.mockResolvedValue({ followerId: 'fan_1' });

    await optInToSms('artist_1', 'fan_1', '(312) 555-0100', now);

    expect(types()).toEqual(['sms.opted_in']);
  });

  it('leaving reports both opt-outs, and the email link reports the email one', async () => {
    await leaveFanList('artist_1', 'fan_1', now);
    expect(types()).toEqual(['email.opted_out', 'sms.opted_out']);

    emit.mockClear();
    db.fan_list_members.updateMany.mockResolvedValue({ count: 0 });
    await leaveFanList('artist_1', 'fan_1', now);
    expect(emit).not.toHaveBeenCalled();

    db.fan_list_members.updateMany.mockResolvedValue({ count: 1 });
    db.fan_list_members.findUnique.mockResolvedValue({ ...member(), artist: { displayName: 'N' } });
    await unsubscribeByToken('tok_1', now);
    expect(emit.mock.calls[0][0]).toMatchObject({
      type: 'email.opted_out',
      artistId: 'artist_1',
      fanId: 'fan_1',
      data: { reason: 'unsubscribe_link' },
    });
  });

  it('STOP reports an opt-out for every list the number was on', async () => {
    db.fan_list_members.findMany.mockResolvedValue([
      { artistId: 'artist_1', fanId: 'fan_1' },
      { artistId: 'artist_2', fanId: 'fan_1' },
    ]);

    await handleInboundSms('+13125550100', 'STOP', now);

    const events = (emitMarketingEvents as jest.Mock).mock.calls[0][0];
    expect(events.map((e: any) => [e.type, e.artistId])).toEqual([
      ['sms.opted_out', 'artist_1'],
      ['sms.opted_out', 'artist_2'],
    ]);
  });
});

describe('export', () => {
  it('shows only the channels each fan opted in to, and neutralises formulas', async () => {
    db.fan_list_members.findMany.mockResolvedValue([
      member(),
      member({
        id: 'm_2',
        fanId: 'fan_2',
        emailUnsubscribedAt: now,
        smsPhone: '+13125550100',
        smsConsentedAt: now,
        fan: { displayName: '=HYPERLINK("x")', email: 'left@example.com' },
      }),
    ]);

    const csv = await exportFanListCsv('artist_1');
    const lines = csv.trim().split('\r\n');

    expect(lines[0]).toBe('email,phone,name,source,joined_at');
    expect(lines[1]).toContain('"fan1@example.com",""');
    // Fan 2 left email, so their address is not handed over.
    expect(lines[2]).not.toContain('left@example.com');
    expect(lines[2]).toContain('"+13125550100"');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('quotes cells', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('@me')).toBe(`"'@me"`);
  });
});

describe('announcements', () => {
  beforeEach(() => {
    db.fan_list_announcements.count.mockResolvedValue(0);
    db.fan_list_announcements.create.mockResolvedValue({});
    db.fan_list_announcements.update.mockResolvedValue({});
  });

  it('emails fans who get email, each with their own unsubscribe link', async () => {
    db.fan_list_members.findMany.mockResolvedValue([
      member(),
      member({ id: 'm_2', unsubscribeToken: 'tok_2', fan: { displayName: 'B', email: 'b@x.com' } }),
    ]);

    const result = await sendAnnouncement(
      'artist_1',
      { subject: 'New single Friday', message: 'Out Friday <b>early</b>' },
      'https://app.test',
      now
    );

    expect(result).toMatchObject({ recipientCount: 2, failedCount: 0, smsRecipientCount: 0 });
    const first = sendEmail.mock.calls[0][0];
    expect(first.to).toBe('fan1@example.com');
    expect(first.headers['List-Unsubscribe']).toBe(
      '<https://app.test/api/fan-list/unsubscribe?token=tok_1>'
    );
    expect(first.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(first.html).toContain('Out Friday &lt;b&gt;early&lt;/b&gt;');
    expect(sendEmail.mock.calls[1][0].text).toContain('token=tok_2');
  });

  it('counts emails that fail', async () => {
    db.fan_list_members.findMany.mockResolvedValue([member()]);
    sendEmail.mockResolvedValue({ success: false });

    const result = await sendAnnouncement('artist_1', { subject: 's', message: 'm' }, '', now);

    expect(result).toMatchObject({ recipientCount: 0, failedCount: 1 });
  });

  it('texts only fans who opted in to texts, with STOP wording', async () => {
    process.env.SMS_PROVIDER = 'log';
    db.fan_list_members.findMany.mockResolvedValue([
      member(),
      member({ id: 'm_2', smsPhone: '+13125550100', smsConsentedAt: now }),
    ]);

    const result = await sendAnnouncement(
      'artist_1',
      { subject: 's', message: 'm', smsMessage: 'Drop is live' },
      '',
      now
    );

    expect(result).toMatchObject({ recipientCount: 2, smsRecipientCount: 1, smsFailedCount: 0 });
    expect(buildAnnouncementSms('Nahvee', 'Drop is live')).toBe(
      'Nahvee: Drop is live Reply STOP to opt out.'
    );
  });

  it('refuses a text announcement while no text provider is set up', async () => {
    await expect(
      sendAnnouncement('artist_1', { subject: 's', message: 'm', smsMessage: 'x' }, '', now)
    ).rejects.toMatchObject({ status: 503 });
    expect(db.fan_list_announcements.create).not.toHaveBeenCalled();
  });

  it(`allows ${MAX_ANNOUNCEMENTS_PER_DAY} a day`, async () => {
    db.fan_list_announcements.count.mockResolvedValue(MAX_ANNOUNCEMENTS_PER_DAY);

    await expect(
      sendAnnouncement('artist_1', { subject: 's', message: 'm' }, '', now)
    ).rejects.toMatchObject({ status: 429 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('refuses when nobody is on the list', async () => {
    db.fan_list_members.findMany.mockResolvedValue([]);

    await expect(
      sendAnnouncement('artist_1', { subject: 's', message: 'm' }, '', now)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('builds a plain-text and HTML email with an unsubscribe footer', () => {
    const email = buildAnnouncementEmail('Nahvee', { subject: 'S', message: 'Hi' }, 'https://u');
    expect(email.text).toContain('Unsubscribe: https://u');
    expect(email.html).toContain('href="https://u"');
  });
});
