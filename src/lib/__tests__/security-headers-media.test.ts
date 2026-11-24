import { permissionsPolicyFor, SecurityHeadersManager } from '@/lib/security-headers';

describe('camera and microphone', () => {
  it('are allowed only on the listening party broadcast page', () => {
    expect(permissionsPolicyFor('/dashboard/artist/livestreams/abc/broadcast')).toContain(
      'camera=(self), microphone=(self)'
    );
    for (const path of [
      undefined,
      '/',
      '/stream/abc',
      '/studio',
      '/dashboard/artist/livestreams',
      '/dashboard/artist/livestreams/abc/broadcast/extra',
      '/dashboard/artist/livestreams/a/b/broadcast',
    ]) {
      expect(permissionsPolicyFor(path)).toContain('camera=(), microphone=()');
    }
  });

  it('let the page play and broadcast to Amazon IVS', () => {
    const csp = SecurityHeadersManager.getSecurityHeaders()['Content-Security-Policy'];
    expect(csp).toContain('https://*.live-video.net');
    expect(csp).toContain("media-src 'self' blob:");
  });
});
