import Link from 'next/link';
import { ArrowUpRight, Radio } from 'lucide-react';
import { Artwork, AVAILABILITY, formatMoney, ScarcityMeter, StagePill } from './primitives';
import { LocalTime } from './time';
import { isPayWhatYouWant, type StageArtist, type StageDrop, type StageParty } from './types';

/** The date line a drop shows: when it opens, or when it closes. */
export function DropTiming({ drop }: { drop: StageDrop }) {
  if (drop.availability === 'not_started') {
    return (
      <>
        {drop.presaleStartsAt ? 'Members from ' : 'Opens '}
        <LocalTime iso={drop.presaleStartsAt ?? drop.startsAt} />
      </>
    );
  }
  if (drop.availability === 'presale') {
    return (
      <>
        Public sale <LocalTime iso={drop.startsAt} />
      </>
    );
  }
  if (drop.endsAt && drop.availability === 'on_sale') {
    return (
      <>
        Ends <LocalTime iso={drop.endsAt} />
      </>
    );
  }
  return null;
}

export function DropPrice({ drop, size = 'md' }: { drop: StageDrop; size?: 'md' | 'lg' }) {
  const pwyw = isPayWhatYouWant(drop);
  return (
    <div className='stage-figures flex flex-wrap items-baseline gap-x-3 gap-y-1'>
      <span className={size === 'lg' ? 'text-4xl font-semibold' : 'text-lg font-semibold'}>
        {pwyw && <span className='mr-1 text-[0.55em] font-medium text-stage-muted'>from</span>}
        {formatMoney(drop.price)}
      </span>
      {drop.memberPrice !== null && (
        <span className='text-sm text-stage-ember'>Members {formatMoney(drop.memberPrice)}</span>
      )}
    </div>
  );
}

/** A drop as a piece of media first, a product second. */
export function DropCard({ drop }: { drop: StageDrop }) {
  const status = AVAILABILITY[drop.availability];
  const ended = drop.availability === 'sold_out' || drop.availability === 'ended';
  return (
    <Link
      href={`/drops/${drop.id}`}
      className='group flex h-full flex-col overflow-hidden rounded-media border border-stage-line bg-stage-surface transition-colors duration-300 ease-stage hover:border-stage-line-strong'
    >
      <div className='relative aspect-square overflow-hidden'>
        <Artwork
          src={drop.artwork}
          name={drop.title}
          rounded='rounded-none'
          className='transition-transform duration-500 ease-stage group-hover:scale-[1.03] motion-reduce:transform-none'
        />
        <div className='absolute left-3 top-3'>
          <StagePill tone={status.tone}>{status.label}</StagePill>
        </div>
      </div>
      <div className='flex flex-1 flex-col gap-3 p-5'>
        <div>
          <p className='text-sm text-stage-subtle'>{drop.artistName}</p>
          <h3 className='mt-0.5 flex items-start justify-between gap-2 text-lg font-semibold leading-snug text-stage-text'>
            <span className={ended ? 'text-stage-muted' : undefined}>{drop.title}</span>
            <ArrowUpRight
              aria-hidden
              className='mt-1 h-4 w-4 shrink-0 text-stage-subtle transition-transform duration-300 ease-stage group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-stage-pulse'
            />
          </h3>
        </div>
        <DropPrice drop={drop} />
        <div className='mt-auto space-y-3'>
          {drop.remaining !== null &&
            !ended &&
            (drop.quantityLimit !== null ? (
              <ScarcityMeter remaining={drop.remaining} total={drop.quantityLimit} />
            ) : (
              <p className='text-xs font-medium text-stage-ember'>{drop.remaining} left</p>
            ))}
          <p className='text-xs text-stage-subtle'>
            <DropTiming drop={drop} />
          </p>
        </div>
      </div>
    </Link>
  );
}

function DateBlock({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const date = new Date(iso);
  return (
    <div
      aria-hidden
      className='flex w-16 shrink-0 flex-col items-center justify-center rounded-control border border-stage-line-strong bg-stage-ink py-2'
    >
      <span className='font-mono text-[10px] uppercase tracking-[0.18em] text-stage-ember'>
        {date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}
      </span>
      <span className='stage-figures text-2xl font-semibold leading-none text-stage-text'>
        {date.toLocaleString('en-US', { day: 'numeric', timeZone: 'UTC' })}
      </span>
    </div>
  );
}

/** A listening party: when, who, how much, and whether it's live right now. */
export function PartyCard({ party }: { party: StageParty }) {
  const live = party.status === 'LIVE';
  return (
    <Link
      href={`/parties/${party.id}`}
      className='group flex items-center gap-4 rounded-media border border-stage-line bg-stage-surface p-4 transition-colors duration-300 ease-stage hover:border-stage-line-strong sm:p-5'
    >
      {live ? (
        <div className='flex h-[60px] w-16 shrink-0 items-center justify-center rounded-control bg-stage-live/15'>
          <Radio aria-hidden className='h-6 w-6 text-stage-live' />
        </div>
      ) : (
        <DateBlock iso={party.scheduledAt} />
      )}
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <p className='truncate text-sm text-stage-subtle'>{party.artist.displayName}</p>
          {live && (
            <StagePill tone='live' live>
              Live
            </StagePill>
          )}
        </div>
        <h3 className='mt-0.5 truncate text-base font-semibold text-stage-text sm:text-lg'>
          {party.title}
        </h3>
        <p className='mt-1 text-xs text-stage-subtle'>
          {live ? (
            'Happening now'
          ) : party.scheduledAt ? (
            <LocalTime iso={party.scheduledAt} />
          ) : (
            'Date to be announced'
          )}
        </p>
      </div>
      <div className='text-right'>
        <p className='stage-figures text-base font-semibold text-stage-text'>
          {formatMoney(party.price)}
        </p>
        <p className='text-xs text-stage-subtle'>ticket</p>
      </div>
    </Link>
  );
}

export function ArtistTile({ artist }: { artist: StageArtist }) {
  return (
    <Link href={`/membership/${artist.id}`} className='group block'>
      <div className='aspect-[4/5] overflow-hidden rounded-media border border-stage-line'>
        <Artwork
          src={artist.avatar}
          name={artist.displayName}
          rounded='rounded-none'
          className='grayscale transition duration-500 ease-stage group-hover:scale-[1.03] group-hover:grayscale-0 motion-reduce:transform-none'
        />
      </div>
      <p className='mt-3 font-semibold text-stage-text'>{artist.displayName}</p>
      <p className='text-sm text-stage-subtle transition-colors group-hover:text-stage-pulse'>
        Membership and drops
      </p>
    </Link>
  );
}
