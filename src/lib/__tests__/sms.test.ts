import { getSmsProvider, maskPhone, normalizePhone, parseSmsKeyword } from '@/lib/sms';

describe('sms', () => {
  it('is switched off unless a known provider is named', () => {
    expect(getSmsProvider({})).toBeNull();
    expect(getSmsProvider({ SMS_PROVIDER: '' })).toBeNull();
    expect(getSmsProvider({ SMS_PROVIDER: 'nope' })).toBeNull();
    expect(getSmsProvider({ SMS_PROVIDER: 'log' })?.name).toBe('log');
  });

  it('test mode reports a send without contacting anyone', async () => {
    const provider = getSmsProvider({ SMS_PROVIDER: 'log' })!;
    await expect(provider.send('+13125550100', 'hi')).resolves.toMatchObject({ success: true });
  });

  it.each([
    ['(312) 555-0100', '+13125550100'],
    ['1-312-555-0100', '+13125550100'],
    ['+44 20 7946 0958', '+442079460958'],
    ['5550100', null],
    ['+0123456789', null],
    ['call me', null],
  ])('reads %s as %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ['STOP', 'stop'],
    ['stop.', 'stop'],
    ['Unsubscribe', 'stop'],
    ['HELP', 'help'],
    ['stop texting me about this', null],
  ])('reads %s as %s', (body, expected) => {
    expect(parseSmsKeyword(body)).toBe(expected);
  });

  it('masks numbers in logs', () => {
    expect(maskPhone('+13125550100')).toBe('********0100');
  });
});
