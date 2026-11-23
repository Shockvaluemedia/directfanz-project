/**
 * Reads a video's length and size in the browser and grabs one frame as its
 * poster, before upload. The poster is uploaded like any other image and saved
 * as the content's thumbnail, so fans see a still before they press play (and
 * on the paywall). Browser-only; nothing here runs on the server.
 */

export interface MediaDetails {
  duration?: number;
  dimensions?: { width: number; height: number };
  /** JPEG frame from the video, for the poster. */
  poster?: Blob;
}

/** Widest poster we keep; larger frames are scaled down. */
export const POSTER_MAX_WIDTH = 1280;

/**
 * Where to take the poster frame: a tenth of the way in (opening frames are
 * often black), at least half a second and at most ten seconds in, and never
 * past the end.
 */
export function posterFrameTime(duration: number | undefined): number {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return 0;
  const target = Math.min(Math.max(duration * 0.1, 0.5), 10);
  return Math.max(0, Math.min(target, duration - 0.1));
}

/** Poster size that keeps the aspect ratio within POSTER_MAX_WIDTH. */
export function posterSize(width: number, height: number): { width: number; height: number } {
  if (width <= POSTER_MAX_WIDTH) return { width, height };
  const scale = POSTER_MAX_WIDTH / width;
  return { width: POSTER_MAX_WIDTH, height: Math.round(height * scale) };
}

function once<T extends Event>(target: EventTarget, name: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.removeEventListener(name, onEvent);
      reject(new Error(`Timed out waiting for ${name}`));
    }, timeoutMs);
    const onEvent = (event: Event) => {
      clearTimeout(timer);
      target.removeEventListener(name, onEvent);
      resolve(event as T);
    };
    target.addEventListener(name, onEvent);
  });
}

/** Length of an audio file, read by the browser. */
export async function readAudioDuration(file: File): Promise<number | undefined> {
  const url = URL.createObjectURL(file);
  try {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    await once(audio, 'loadedmetadata', 15000);
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Length, size and a poster frame for a video file. Anything the browser can't
 * decode (for example some .mov files) comes back empty rather than failing,
 * since the upload itself can still go ahead.
 */
export async function readVideoDetails(file: File): Promise<MediaDetails> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  const details: MediaDetails = {};
  try {
    await once(video, 'loadedmetadata', 15000);
    if (Number.isFinite(video.duration) && video.duration > 0) details.duration = video.duration;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      details.dimensions = { width: video.videoWidth, height: video.videoHeight };
    }

    if (details.dimensions) {
      video.currentTime = posterFrameTime(details.duration);
      await once(video, 'seeked', 15000);
      const size = posterSize(details.dimensions.width, details.dimensions.height);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, size.width, size.height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (blob && blob.size > 0) details.poster = blob;
      }
    }
  } catch {
    // Keep whatever was read before the failure.
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
  return details;
}
