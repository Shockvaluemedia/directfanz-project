import { checkCronAuth } from '@/lib/cron-auth';

describe('scheduled route auth', () => {
  it('is off without a secret, and checks the bearer exactly', () => {
    expect(checkCronAuth('Bearer x', undefined)).toBe('off');
    expect(checkCronAuth('Bearer x', '')).toBe('off');
    expect(checkCronAuth('Bearer s3cret', 's3cret')).toBe('ok');
    expect(checkCronAuth('Bearer s3cre', 's3cret')).toBe('unauthorized');
    expect(checkCronAuth('s3cret', 's3cret')).toBe('unauthorized');
    expect(checkCronAuth(null, 's3cret')).toBe('unauthorized');
  });
});
