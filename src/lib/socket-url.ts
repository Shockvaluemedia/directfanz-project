/**
 * Where the browser opens its socket.io connection. One setting for the whole
 * app: NEXT_PUBLIC_WEBSOCKET_URL. Left unset, it is the site's own origin,
 * because server.ts serves socket.io from the same process as the pages.
 * (Replaces the older NEXT_PUBLIC_WS_URL and NEXT_PUBLIC_SOCKET_URL.)
 */
export function getSocketUrl(
  configured: string | undefined = process.env.NEXT_PUBLIC_WEBSOCKET_URL
): string {
  if (configured && configured.trim()) return configured.trim();
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
