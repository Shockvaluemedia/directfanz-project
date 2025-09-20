# OAuth Security Enhancement Setup Guide

This guide covers the implementation of enhanced OAuth security measures to
address token handling vulnerabilities.

## Security Improvements Implemented

### 1. OAuth Token Security

- **Fixed**: OAuth tokens no longer exposed in JWT or client-side sessions
- **Added**: Encrypted storage of OAuth tokens in database
- **Added**: Secure server-side token refresh endpoint
- **Added**: Token rotation with proper expiration handling

### 2. Session Security

- **Enhanced**: Shorter session duration (2 hours instead of 30 days)
- **Added**: Secure cookie configuration
- **Added**: Session invalidation mechanisms
- **Added**: Session hijacking detection

### 3. CSRF Protection

- **Added**: CSRF token validation for all state-changing operations
- **Added**: CSRF token API endpoint
- **Added**: Proper token generation and validation

### 4. Enhanced Middleware

- **Added**: OAuth-specific security checks
- **Added**: Session security monitoring
- **Enhanced**: Rate limiting with different tiers
- **Added**: Suspicious activity detection

## Environment Variables Required

Add these new environment variables to your `.env.local` file:

```bash
# OAuth Token Encryption (REQUIRED)
# Generate with: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=your_32_character_hex_key_here

# Session Security (already exists, but ensure it's secure)
NEXTAUTH_SECRET=your_nextauth_secret_here

# OAuth Provider Credentials (already exists)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret
```

## Database Migration

Run the following commands to apply the database changes:

```bash
# Generate the migration
npx prisma migrate dev --name oauth_security_enhancement

# Apply to production (when ready)
npx prisma migrate deploy
```

## Client-Side Changes Required

### 1. CSRF Token Integration

For any forms or API calls that modify data, you'll need to include CSRF tokens:

```typescript
// Get CSRF token
const getCSRFToken = async () => {
  const response = await fetch('/api/auth/csrf');
  const { csrfToken } = await response.json();
  return csrfToken;
};

// Include in API requests
const makeSecureRequest = async (url: string, data: any) => {
  const csrfToken = await getCSRFToken();

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
  });
};
```

### 2. Session Management

You can now manage user sessions more securely:

```typescript
// Invalidate all sessions (force re-login everywhere)
const invalidateAllSessions = async () => {
  const csrfToken = await getCSRFToken();

  return fetch('/api/auth/session', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ invalidateAll: true }),
  });
};

// Get session information
const getSessionInfo = async () => {
  return fetch('/api/auth/session').then(r => r.json());
};
```

### 3. OAuth Token Refresh

OAuth tokens are now refreshed server-side only:

```typescript
// Refresh OAuth tokens (server-side only)
const refreshOAuthTokens = async (provider: string) => {
  const csrfToken = await getCSRFToken();

  return fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ provider }),
  });
};
```

## Security Best Practices Implemented

### 1. Token Security

- ✅ OAuth tokens encrypted at rest
- ✅ No token exposure to client-side JavaScript
- ✅ Proper token rotation and expiration
- ✅ Secure token refresh mechanism

### 2. Session Security

- ✅ Reduced session duration (2 hours)
- ✅ HttpOnly and Secure cookies
- ✅ Session hijacking detection
- ✅ Force session invalidation capability

### 3. CSRF Protection

- ✅ CSRF tokens for state-changing operations
- ✅ Double-submit cookie pattern
- ✅ Proper token validation

### 4. Monitoring & Logging

- ✅ Security event logging
- ✅ Suspicious activity detection
- ✅ OAuth refresh attempt auditing
- ✅ Session security monitoring

## Testing the Security Enhancements

### 1. Test CSRF Protection

```bash
# This should fail without CSRF token
curl -X POST https://www.directfanz.io/api/some-endpoint \
  -H "Content-Type: application/json" \
  -d '{"data": "test"}'

# This should work with CSRF token
curl -X GET https://www.directfanz.io/api/auth/csrf
curl -X POST https://www.directfanz.io/api/some-endpoint \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_token_here" \
  -d '{"data": "test"}'
```

### 2. Test Session Security

```bash
# Get session info
curl -X GET https://www.directfanz.io/api/auth/session \
  -H "Cookie: your_session_cookie"

# Invalidate session
curl -X DELETE https://www.directfanz.io/api/auth/session \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_token_here" \
  -d '{"invalidateAll": true}'
```

### 3. Test OAuth Refresh

```bash
# Refresh Google OAuth tokens
curl -X POST https://www.directfanz.io/api/auth/refresh \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_token_here" \
  -d '{"provider": "google"}'
```

## Migration from Previous Implementation

### Breaking Changes

1. **Session Duration**: Sessions now expire after 2 hours instead of 30 days
2. **CSRF Required**: All POST/PUT/DELETE/PATCH requests require CSRF tokens
3. **OAuth Tokens**: No longer accessible client-side (session.accessToken
   removed)

### Recommended Migration Steps

1. Update environment variables
2. Run database migration
3. Update client-side code to handle CSRF tokens
4. Remove any client-side OAuth token usage
5. Test authentication flows thoroughly
6. Deploy to staging first, then production

## Monitoring & Alerts

The security enhancements include comprehensive logging. Monitor these events:

- `CSRF_TOKEN_INVALID`: CSRF validation failures
- `SESSION_SECURITY_CHECK_FAILED`: Potential session hijacking
- `OAuth token refresh attempt`: OAuth token refresh activities
- `Suspicious activity detected`: Unusual request patterns

Set up alerts for these security events in your monitoring system.

## Support

If you encounter issues with the OAuth security enhancements:

1. Check environment variables are set correctly
2. Ensure database migration completed successfully
3. Verify CSRF tokens are included in requests
4. Check browser console for client-side errors
5. Review server logs for security events
