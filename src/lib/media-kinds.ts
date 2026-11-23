/**
 * What a piece of content is, beyond its file type: a single or a project
 * track for music, and the kinds of creative video DirectFanz releases
 * (shorts, music videos, documentaries, films, episodes and more). Stored as
 * `kind` inside the content row's metadata JSON, so no schema change is needed.
 * Client-safe: no server imports.
 */

export const AUDIO_KINDS = {
  SINGLE: 'Single',
  PROJECT_TRACK: 'Project track (EP or album)',
  PODCAST: 'Podcast or talk',
  OTHER_AUDIO: 'Other audio',
} as const;

export const VIDEO_KINDS = {
  SHORT: 'Short',
  MUSIC_VIDEO: 'Music video',
  DOCUMENTARY: 'Documentary',
  FILM: 'Film',
  EPISODE: 'Series episode',
  BEHIND_THE_SCENES: 'Behind the scenes',
  LIVE_PERFORMANCE: 'Live performance',
  OTHER_VIDEO: 'Other video',
} as const;

export type AudioKind = keyof typeof AUDIO_KINDS;
export type VideoKind = keyof typeof VIDEO_KINDS;
export type MediaKind = AudioKind | VideoKind;

export const MEDIA_KINDS = { ...AUDIO_KINDS, ...VIDEO_KINDS } as const;

/** The kinds an artist can pick for content of this type (none for images and documents). */
export function kindsForType(type: string): Partial<Record<MediaKind, string>> {
  if (type === 'AUDIO') return AUDIO_KINDS;
  if (type === 'VIDEO') return VIDEO_KINDS;
  return {};
}

export function isKindForType(kind: unknown, type: string): kind is MediaKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(kindsForType(type), kind);
}

/** Videos up to this long are suggested as shorts. */
export const SHORT_MAX_SECONDS = 3 * 60;
/** Videos at least this long are suggested as films. */
export const FILM_MIN_SECONDS = 40 * 60;

/** A starting suggestion from the file's type and length; the artist can change it. */
export function suggestKind(type: string, durationSeconds?: number | null): MediaKind | undefined {
  if (type === 'AUDIO') return 'SINGLE';
  if (type !== 'VIDEO') return undefined;
  if (!durationSeconds || durationSeconds <= 0) return undefined;
  if (durationSeconds <= SHORT_MAX_SECONDS) return 'SHORT';
  if (durationSeconds >= FILM_MIN_SECONDS) return 'FILM';
  return undefined;
}

/** Reads `kind` from a content row's metadata JSON, ignoring anything invalid. */
export function kindFromMetadata(metadata: string | null | undefined, type: string): MediaKind | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    return isKindForType(parsed?.kind, type) ? parsed.kind : null;
  } catch {
    return null;
  }
}

/** Runtime as "1:02:05" or "4:07", for release pages and lists. */
export function formatRuntime(totalSeconds: number | null | undefined): string | null {
  if (!totalSeconds || totalSeconds <= 0 || !Number.isFinite(totalSeconds)) return null;
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
