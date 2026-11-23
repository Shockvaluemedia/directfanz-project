/** Fan-facing pages drawn in the dark stage style; everything else stays light. */
export const STAGE_PREFIXES = [
  '/community',
  '/drops',
  '/parties',
  '/membership',
  '/design-preview',
];

export function isStagePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return STAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}
