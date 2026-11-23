/**
 * Artist invite links. The code rides in the URL fragment (#invite=...),
 * which browsers never send to the server, so it stays out of access logs
 * and referrers. Safe to import from client components.
 */

const MAX_CODE_LENGTH = 200;

/** Sign-up link for an invite code, or undefined when the app URL is unknown. */
export function inviteSignupUrl(code: string, appUrl: string | undefined): string | undefined {
  if (!appUrl) return undefined;
  return `${appUrl.replace(/\/+$/, '')}/auth/signup#invite=${encodeURIComponent(code)}`;
}

/** The invite code from a sign-up link's fragment, e.g. "#invite=abc". */
export function readInviteFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get('invite')?.trim();
  return code && code.length <= MAX_CODE_LENGTH ? code : null;
}
