import type { StageMedia } from './types';

/** One piece of content attached to a release, as much as the stage needs. */
export interface MediaItem {
  type: string;
  thumbnailUrl: string | null;
  duration: number | null;
}

/** Shorts run up to 40 minutes; longer single videos read as films. */
export const SHORT_FILM_MAX_SECONDS = 40 * 60;

/**
 * Reads a release's kind and format from what is attached to it. Any video
 * makes it a video release; otherwise one track is a Single and more are a
 * Project. Documentary can't be told from the files, so it needs an explicit
 * format once the data has one.
 */
export function describeMedia(items: MediaItem[]): StageMedia {
  const videos = items.filter(item => item.type.toUpperCase() === 'VIDEO');
  if (videos.length > 0) {
    const durations = videos.map(video => video.duration).filter((d): d is number => !!d && d > 0);
    const runtimeSeconds = durations.length ? durations.reduce((sum, d) => sum + d, 0) : null;
    const format =
      videos.length > 1
        ? 'Series'
        : runtimeSeconds === null
          ? 'Video'
          : runtimeSeconds <= SHORT_FILM_MAX_SECONDS
            ? 'Short'
            : 'Film';
    return {
      kind: 'video',
      format,
      poster: videos.find(video => video.thumbnailUrl)?.thumbnailUrl ?? null,
      runtimeSeconds,
      previewUrl: null,
    };
  }
  const tracks = items.filter(item => item.type.toUpperCase() === 'AUDIO').length;
  return {
    kind: 'music',
    format: tracks > 1 ? 'Project' : 'Single',
    poster: null,
    runtimeSeconds: null,
    previewUrl: null,
  };
}

/** 754 -> "13 min", 5520 -> "1 hr 32 min". */
export function formatRuntime(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
