/**
 * Keeps long videos playing past the life of one signed link.
 *
 * The stream route answers with a redirect to a signed S3 link that lives an
 * hour (S3_STREAM_URL_TTL_SECONDS), or less if the server's temporary AWS
 * credentials rotate first. A film or documentary can run longer, and seeking
 * after the link has expired fails. When that happens the player asks the
 * stream route again (which re-checks access and signs a new link) and resumes
 * where the viewer was. Client-safe.
 */

/** Recoveries allowed per video before the error is shown. */
export const MAX_PLAYBACK_RECOVERIES = 5;
/** Two failures this close together mean the file itself is the problem. */
export const MIN_MS_BETWEEN_RECOVERIES = 20 * 1000;

export interface RecoveryState {
  /** The video loaded and played at least once (so the file itself is playable). */
  hadLoaded: boolean;
  recoveries: number;
  lastRecoveryAt: number | null;
  now: number;
}

export function shouldRecoverPlayback(state: RecoveryState): boolean {
  if (!state.hadLoaded) return false;
  if (state.recoveries >= MAX_PLAYBACK_RECOVERIES) return false;
  if (state.lastRecoveryAt !== null && state.now - state.lastRecoveryAt < MIN_MS_BETWEEN_RECOVERIES) {
    return false;
  }
  return true;
}

/**
 * The same app URL with a retry marker, so the browser fetches the redirect
 * again instead of reusing the expired link. The stream route ignores it.
 */
export function withPlaybackAttempt(src: string, attempt: number): string {
  if (attempt <= 0) return src;
  const [base, hash = ''] = src.split('#');
  const cleaned = base.replace(/([?&])_attempt=\d+(&|$)/, (_, lead: string, tail: string) => (tail ? lead : ''));
  const separator = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${separator}_attempt=${attempt}${hash ? `#${hash}` : ''}`;
}

/** Container formats most browsers can't play without conversion. */
export function isLikelyUnplayableInBrowsers(format: string | null | undefined): boolean {
  const value = (format ?? '').toLowerCase();
  return /quicktime|(^|\/|\.)mov$|x-msvideo|avi|matroska|mkv|wmv/.test(value);
}
