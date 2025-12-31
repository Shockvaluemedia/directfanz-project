import { getAuthManager } from '../../src/lib/auth-production';

describe('Property Test: Authentication Configuration Correctness', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    // Set up valid test environment
    Object.assign(process.env, {
      NEXTAUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_URL: 'https://directfanz.io',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/test',
      NODE_ENV: 'production',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authentication Security Configuration', () => {
    test('Property 3: Production authentication must use HTTPS', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXTAUTH_URL = 'https://directfanz.io';
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Should not throw with HTTPS URL
      expect(authManager).toBeDefined();
      
      // Cookies should be secure in production
      expect(config.cookies?.sessionToken?.options?.secure).toBe(true);
      expect(config.cookies?.callbackUrl?.options?.secure).toBe(true);
      expect(config.cookies?.csrfToken?.options?.secure).toBe(true);
    });

    test('Property 3: HTTP URLs should be rejected in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXTAUTH_URL = 'http://directfanz.io';
      
      expect(() => getAuthManager()).toThrow(/must use HTTPS in production/);
    });

    test('Property 3: NEXTAUTH_SECRET must be sufficiently long', () => {
      const weakSecrets = ['short', 'a'.repeat(16), 'a'.repeat(31)];
      
      for (const secret of weakSecrets) {
        process.env.NEXTAUTH_SECRET = secret;
        
        expect(() => getAuthManager()).toThrow(/must be at least 32 characters long/);
      }
    });

    test('Property 3: Required environment variables must be present', () => {
      const requiredVars = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
      
      for (const varName of requiredVars) {
        delete process.env[varName];
        
        expect(() => getAuthManager()).toThrow(new RegExp(`${varName}.*required`));
        
        // Restore for next iteration
        process.env[varName] = originalEnv[varName];
      }
    });
  });

  describe('Session Security Configuration', () => {
    test('Property 3: Session configuration should be secure', () => {
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Session should use JWT strategy
      expect(config.session?.strategy).toBe('jwt');
      
      // Session should have reasonable max age (30 days)
      expect(config.session?.maxAge).toBe(30 * 24 * 60 * 60);
      
      // Session should update regularly (24 hours)
      expect(config.session?.updateAge).toBe(24 * 60 * 60);
    });

    test('Property 3: Cookie configuration should be secure', () => {
      process.env.NODE_ENV = 'production';
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // All cookies should be HTTP-only
      expect(config.cookies?.sessionToken?.options?.httpOnly).toBe(true);
      expect(config.cookies?.callbackUrl?.options?.httpOnly).toBe(true);
      expect(config.cookies?.csrfToken?.options?.httpOnly).toBe(true);
      
      // All cookies should use SameSite protection
      expect(config.cookies?.sessionToken?.options?.sameSite).toBe('lax');
      expect(config.cookies?.callbackUrl?.options?.sameSite).toBe('lax');
      expect(config.cookies?.csrfToken?.options?.sameSite).toBe('lax');
      
      // Production cookies should be secure
      expect(config.cookies?.sessionToken?.options?.secure).toBe(true);
      expect(config.cookies?.callbackUrl?.options?.secure).toBe(true);
      expect(config.cookies?.csrfToken?.options?.secure).toBe(true);
    });

    test('Property 3: Cookie names should use security prefixes in production', () => {
      process.env.NODE_ENV = 'production';
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Session and callback cookies should use __Secure- prefix
      expect(config.cookies?.sessionToken?.name).toContain('__Secure-');
      expect(config.cookies?.callbackUrl?.name).toContain('__Secure-');
      
      // CSRF token should use __Host- prefix
      expect(config.cookies?.csrfToken?.name).toContain('__Host-');
    });
  });

  describe('Provider Security Configuration', () => {
    test('Property 3: Credentials provider should implement secure authentication', () => {
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Should have credentials provider
      const credentialsProvider = config.providers?.find(p => p.id === 'credentials');
      expect(credentialsProvider).toBeDefined();
      
      // Provider should have authorize function
      expect(typeof credentialsProvider?.authorize).toBe('function');
    });

    test('Property 3: OAuth providers should be properly configured', () => {
      // Set up OAuth environment
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Should include Google provider when configured
      const googleProvider = config.providers?.find(p => p.id === 'google');
      expect(googleProvider).toBeDefined();
    });

    test('Property 3: OAuth providers should not be included without credentials', () => {
      // Remove OAuth credentials
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Should not include Google provider without credentials
      const googleProvider = config.providers?.find(p => p.id === 'google');
      expect(googleProvider).toBeUndefined();
    });
  });

  describe('Security Headers Configuration', () => {
    test('Property 3: Security headers should be comprehensive', () => {
      const authManager = getAuthManager();
      const headers = authManager.getSecurityHeaders();
      
      // Should include all essential security headers
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toContain('camera=()');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    });

    test('Property 3: CSP header should be restrictive', () => {
      const authManager = getAuthManager();
      const headers = authManager.getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Should restrict default sources
      expect(csp).toContain("default-src 'self'");
      
      // Should allow necessary external sources
      expect(csp).toContain('https://js.stripe.com');
      expect(csp).toContain('https://fonts.googleapis.com');
      
      // Should block dangerous sources
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
    });
  });

  describe('Password Security', () => {
    test('Property 3: Password hashing should use secure algorithms', async () => {
      const authManager = getAuthManager();
      
      const password = 'testPassword123!';
      const hash = await authManager.hashPassword(password);
      
      // Hash should be different from password
      expect(hash).not.toBe(password);
      
      // Hash should be bcrypt format
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
      
      // Should verify correctly
      const isValid = await authManager.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      // Should reject wrong password
      const isInvalid = await authManager.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    test('Property 3: Password hashing should be consistent', async () => {
      const authManager = getAuthManager();
      
      const password = 'testPassword123!';
      const hash1 = await authManager.hashPassword(password);
      const hash2 = await authManager.hashPassword(password);
      
      // Hashes should be different (due to salt)
      expect(hash1).not.toBe(hash2);
      
      // Both should verify the same password
      expect(await authManager.verifyPassword(password, hash1)).toBe(true);
      expect(await authManager.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('Callback Security', () => {
    test('Property 3: Redirect callback should validate URLs', () => {
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      const redirectCallback = config.callbacks?.redirect;
      expect(typeof redirectCallback).toBe('function');
      
      if (redirectCallback) {
        const baseUrl = 'https://directfanz.io';
        
        // Should allow relative URLs
        const relativeResult = redirectCallback({ url: '/dashboard', baseUrl });
        expect(relativeResult).toBe(`${baseUrl}/dashboard`);
        
        // Should allow same-origin URLs
        const sameOriginResult = redirectCallback({ 
          url: 'https://directfanz.io/profile', 
          baseUrl 
        });
        expect(sameOriginResult).toBe('https://directfanz.io/profile');
        
        // Should reject external URLs
        const externalResult = redirectCallback({ 
          url: 'https://evil.com/steal-data', 
          baseUrl 
        });
        expect(externalResult).toBe(baseUrl);
      }
    });

    test('Property 3: JWT callback should include necessary claims', () => {
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      const jwtCallback = config.callbacks?.jwt;
      expect(typeof jwtCallback).toBe('function');
    });

    test('Property 3: Session callback should sanitize data', () => {
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      const sessionCallback = config.callbacks?.session;
      expect(typeof sessionCallback).toBe('function');
    });
  });

  describe('Development vs Production Configuration', () => {
    test('Property 3: Development should have different security settings', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Development should allow HTTP
      expect(config.cookies?.sessionToken?.options?.secure).toBe(false);
      
      // Development should enable debug
      expect(config.debug).toBe(true);
    });

    test('Property 3: Production should enforce strict security', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXTAUTH_URL = 'https://directfanz.io';
      
      const authManager = getAuthManager();
      const config = authManager.getNextAuthConfig();
      
      // Production should require secure cookies
      expect(config.cookies?.sessionToken?.options?.secure).toBe(true);
      
      // Production should disable debug
      expect(config.debug).toBe(false);
    });
  });
});