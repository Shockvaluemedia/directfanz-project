/**
 * Error code NextAuth hands back to signIn() when the sign-in guard refuses an
 * attempt. Kept in its own module so the browser bundle can import it without
 * pulling in the server-only guard.
 */
export const LOGIN_BLOCKED_ERROR = 'TooManySignInAttempts';
