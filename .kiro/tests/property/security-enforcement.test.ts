import { SecurityHeadersManager } from '../../src/lib/security-headers';
import { AuthSecurityManager } from '../../src/lib/auth-security';

describe('Property Test: Security Header and Authentication Enforcement', () => {
  describe('Property 12: Security header and authentication enforcement', () => {
    test('All required security headers should be present', () => {
      const headers = SecurityHeadersManager.getSecurityHeaders();
      
      const requiredHeaders = [
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
      ];
      
      requiredHeaders.forEach(header => {
        expect(headers[header]).toBeDefined();
        expect(headers[header]).not.toBe('');
      });
    });

    test('CSP header should be restrictive', () => {
      const headers = SecurityHeadersManager.getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    test('HSTS should be properly configured', () => {
      const headers = SecurityHeadersManager.getSecurityHeaders();
      const hsts = headers['Strict-Transport-Security'];
      
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    test('Rate limiting should be configured for authentication endpoints', () => {
      const rateLimits = AuthSecurityManager.RATE_LIMITS;
      
      expect(rateLimits.LOGIN.maxAttempts).toBeLessThanOrEqual(5);
      expect(rateLimits.LOGIN.windowMs).toBeGreaterThan(0);
      expect(rateLimits.LOGIN.blockDurationMs).toBeGreaterThan(rateLimits.LOGIN.windowMs);
    });

    test('Password strength validation should enforce security requirements', () => {
      const authSecurity = new AuthSecurityManager();
      
      const weakPassword = authSecurity.validatePasswordStrength('123');
      expect(weakPassword.valid).toBe(false);
      expect(weakPassword.issues.length).toBeGreaterThan(0);
      
      const strongPassword = authSecurity.validatePasswordStrength('StrongP@ssw0rd123!');
      expect(strongPassword.score).toBeGreaterThanOrEqual(4);
    });

    test('Account lockout should be implemented', async () => {
      const authSecurity = new AuthSecurityManager();
      
      expect(typeof authSecurity.recordFailedLogin).toBe('function');
      expect(typeof authSecurity.isAccountLocked).toBe('function');
      expect(typeof authSecurity.clearFailedAttempts).toBe('function');
    });

    test('Security header validation should detect missing headers', () => {
      const mockHeaders = new Headers();
      mockHeaders.set('Content-Security-Policy', "default-src 'self'");
      
      const validation = SecurityHeadersManager.validateSecurityHeaders(mockHeaders);
      
      expect(validation.missing.length).toBeGreaterThan(0);
      expect(validation.valid).toBe(false);
    });
  });
});