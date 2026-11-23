import clsx from 'clsx';
import { Film, Lock, Music2 } from 'lucide-react';
import { formatRuntime } from './media';
import { Artwork } from './primitives';
import type { StageMedia } from './types';

/** "Single", "Short · 13 min": the format line with a music or film mark. */
export function MediaBadge({ media, className }: { media: StageMedia; className?: string }) {
  const Icon = media.kind === 'video' ? Film : Music2;
  const runtime = formatRuntime(media.runtimeSeconds);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full bg-stage-ink/80 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-stage-text ring-1 ring-inset ring-white/10 backdrop-blur-sm',
        className
      )}
    >
      <Icon aria-hidden className='h-3.5 w-3.5 text-stage-pulse' />
      {media.format}
      {runtime && <span className='text-stage-muted'>· {runtime}</span>}
    </span>
  );
}

/**
 * The player slot for a video release: a 16:9 frame that plays the public
 * trailer when there is one, and otherwise shows the poster with a note on
 * when it unlocks. The full film is never streamed from here.
 */
export function MediaStage({
  media,
  title,
  fallbackArt,
  note,
}: {
  media: StageMedia;
  title: string;
  fallbackArt: string | null;
  /** Shown over the poster when there is no trailer: "Unlocks when you buy". */
  note: string;
}) {
  const poster = media.poster ?? fallbackArt;
  return (
    <figure className='relative aspect-video w-full overflow-hidden rounded-media border border-stage-line bg-stage-raised shadow-[0_40px_120px_-40px_rgba(142,125,255,0.45)]'>
      {media.previewUrl ? (
        <video
          className='h-full w-full object-cover'
          src={media.previewUrl}
          poster={poster ?? undefined}
          controls
          playsInline
          preload='metadata'
          aria-label={`Trailer for ${title}`}
        />
      ) : (
        <>
          <Artwork src={poster} name={title} rounded='rounded-none' />
          <div className='absolute inset-0 bg-gradient-to-t from-stage-ink/85 via-stage-ink/10 to-transparent' />
          <figcaption className='absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6'>
            <MediaBadge media={media} />
            <span className='flex items-center gap-2 rounded-full bg-stage-ink/70 px-3 py-1.5 text-xs text-stage-text backdrop-blur-sm sm:text-sm'>
              <Lock aria-hidden className='h-3.5 w-3.5 text-stage-pulse' />
              {note}
            </span>
          </figcaption>
        </>
      )}
    </figure>
  );
}
