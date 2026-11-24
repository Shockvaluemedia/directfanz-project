import { decode as defaultDecode } from 'next-auth/jwt';
import { authOptions } from './auth';
import { prisma } from './prisma';

/**
 * Who is on the other end of a socket.io connection, from their real NextAuth
 * session. The browser sends the session cookie with the socket handshake
 * (same site, or withCredentials), and it is checked the same way NextAuth
 * checks it for pages: with this app's own JWT decode and NEXTAUTH_SECRET.
 * The account must still exist and not be banned.
 */

export const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
] as const;

export type SocketRole = 'ARTIST' | 'FAN' | 'ADMIN';

export interface SocketUser {
  id: string;
  name: string;
  role: SocketRole;
}

export interface SocketHandshakeLike {
  headers?: { cookie?: string | string[] | undefined };
  auth?: { token?: unknown } | Record<string, unknown>;
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name || name in cookies) continue;
    const raw = part.slice(index + 1).trim().replace(/^"(.*)"$/, '$1');
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}

/** The session token from the handshake's cookies, or an explicit auth.token. */
export function sessionTokenFrom(handshake: SocketHandshakeLike): string | null {
  const rawCookie = handshake.headers?.cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    for (const name of SESSION_COOKIE_NAMES) {
      if (cookies[name]) return cookies[name];
    }
  }
  const explicit = (handshake.auth as { token?: unknown } | undefined)?.token;
  return typeof explicit === 'string' && explicit ? explicit : null;
}

function asRole(value: unknown): SocketRole {
  return value === 'ARTIST' || value === 'ADMIN' ? value : 'FAN';
}

/** The signed-in user behind a socket handshake, or null. Never throws. */
export async function authenticateSocket(handshake: SocketHandshakeLike): Promise<SocketUser | null> {
  const token = sessionTokenFrom(handshake);
  const secret = process.env.NEXTAUTH_SECRET;
  if (!token || !secret) return null;

  let claims: Record<string, unknown> | null = null;
  try {
    const decode = authOptions.jwt?.decode ?? defaultDecode;
    claims = (await decode({ token, secret })) as Record<string, unknown> | null;
  } catch {
    return null;
  }
  const userId = claims && typeof claims.id === 'string' ? claims.id : null;
  if (!userId) return null;

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, role: true, status: true },
  });
  if (!user || user.status === 'BANNED') return null;

  return { id: user.id, name: user.displayName, role: asRole(user.role) };
}
