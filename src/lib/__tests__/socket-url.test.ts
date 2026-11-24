import { getSocketUrl } from '@/lib/socket-url';

describe('getSocketUrl', () => {
  it('uses NEXT_PUBLIC_WEBSOCKET_URL when set', () => {
    expect(getSocketUrl(' https://ws.directfanz.io ')).toBe('https://ws.directfanz.io');
  });

  it('falls back to the same origin (empty on the server)', () => {
    expect(getSocketUrl(undefined)).toBe('');
    expect(getSocketUrl('')).toBe('');
  });
});
