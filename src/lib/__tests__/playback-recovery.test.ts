import {
  MAX_PLAYBACK_RECOVERIES,
  MIN_MS_BETWEEN_RECOVERIES,
  isLikelyUnplayableInBrowsers,
  shouldRecoverPlayback,
  withPlaybackAttempt,
} from '@/lib/playback-recovery';
import { POSTER_MAX_WIDTH, posterFrameTime, posterSize } from '@/lib/video-poster';

describe('playback recovery', () => {
  const base = { hadLoaded: true, recoveries: 0, lastRecoveryAt: null, now: 1_000_000 };

  it('retries a video that was playing when its link expired', () => {
    expect(shouldRecoverPlayback(base)).toBe(true);
  });

  it('does not retry a file that never loaded (the format is the problem)', () => {
    expect(shouldRecoverPlayback({ ...base, hadLoaded: false })).toBe(false);
  });

  it('stops after repeated or rapid failures', () => {
    expect(shouldRecoverPlayback({ ...base, recoveries: MAX_PLAYBACK_RECOVERIES })).toBe(false);
    expect(
      shouldRecoverPlayback({ ...base, recoveries: 1, lastRecoveryAt: base.now - MIN_MS_BETWEEN_RECOVERIES + 1 })
    ).toBe(false);
    expect(
      shouldRecoverPlayback({ ...base, recoveries: 1, lastRecoveryAt: base.now - MIN_MS_BETWEEN_RECOVERIES - 1 })
    ).toBe(true);
  });

  it('asks the stream route again with a retry marker', () => {
    expect(withPlaybackAttempt('/api/content/c1/stream', 0)).toBe('/api/content/c1/stream');
    expect(withPlaybackAttempt('/api/content/c1/stream', 2)).toBe('/api/content/c1/stream?_attempt=2');
    expect(withPlaybackAttempt('/api/content/c1/stream?x=1', 1)).toBe('/api/content/c1/stream?x=1&_attempt=1');
    expect(withPlaybackAttempt('/api/content/c1/stream?_attempt=1', 2)).toBe('/api/content/c1/stream?_attempt=2');
  });

  it('flags containers most browsers cannot play', () => {
    expect(isLikelyUnplayableInBrowsers('video/quicktime')).toBe(true);
    expect(isLikelyUnplayableInBrowsers('video/x-matroska')).toBe(true);
    expect(isLikelyUnplayableInBrowsers('video/mp4')).toBe(false);
    expect(isLikelyUnplayableInBrowsers('video/webm')).toBe(false);
  });
});

describe('video poster frames', () => {
  it('takes the frame a tenth of the way in, between half a second and ten seconds', () => {
    expect(posterFrameTime(30)).toBe(3);
    expect(posterFrameTime(2)).toBe(0.5);
    expect(posterFrameTime(5400)).toBe(10);
    expect(posterFrameTime(0.3)).toBeCloseTo(0.2);
    expect(posterFrameTime(undefined)).toBe(0);
  });

  it('scales wide frames down and keeps the aspect ratio', () => {
    expect(posterSize(3840, 2160)).toEqual({ width: POSTER_MAX_WIDTH, height: 720 });
    expect(posterSize(720, 1280)).toEqual({ width: 720, height: 1280 });
  });
});
