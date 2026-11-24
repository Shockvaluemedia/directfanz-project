import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { StageDropAvailability } from './types';

/** Whole dollars without cents, otherwise two decimals: $3, $4.50. */
export function formatMoney(dollars: number | string): string {
  const value = typeof dollars === 'string' ? Number(dollars) : dollars;
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

type Tone = 'pulse' | 'ember' | 'live' | 'neutral';

const TONES: Record<Tone, string> = {
  pulse: 'bg-stage-pulse/10 text-stage-pulse ring-stage-pulse/30',
  ember: 'bg-stage-ember/10 text-stage-ember ring-stage-ember/30',
  live: 'bg-stage-live/15 text-stage-live ring-stage-live/40',
  neutral: 'bg-white/5 text-stage-muted ring-white/10',
};

/** A small uppercase status label. Colour is never the only signal: the text says it. */
export function StagePill({
  tone = 'neutral',
  live = false,
  children,
  className,
}: {
  tone?: Tone;
  live?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] ring-1 ring-inset',
        TONES[tone],
        className
      )}
    >
      {live && (
        <span aria-hidden className='stage-live-dot h-1.5 w-1.5 rounded-full bg-stage-live' />
      )}
      {children}
    </span>
  );
}

export const AVAILABILITY: Record<StageDropAvailability, { label: string; tone: Tone }> = {
  on_sale: { label: 'On sale', tone: 'pulse' },
  presale: { label: 'Members presale', tone: 'ember' },
  not_started: { label: 'Coming soon', tone: 'neutral' },
  sold_out: { label: 'Sold out', tone: 'neutral' },
  ended: { label: 'Ended', tone: 'neutral' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
};

/** Small mono label above a heading: "HEADLINER", "DROP 01". */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={clsx(
        'font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-stage-subtle',
        className
      )}
    >
      {children}
    </p>
  );
}

/**
 * Artwork with a dignified fallback: an initials monogram on a lit panel, so a
 * drop with no art still looks designed rather than broken.
 */
export function Artwork({
  src,
  name,
  className,
  rounded = 'rounded-media',
}: {
  src: string | null;
  name: string;
  className?: string;
  rounded?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=''
        loading='lazy'
        className={clsx('h-full w-full object-cover', rounded, className)}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  return (
    <div
      aria-hidden
      className={clsx(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-stage-raised',
        rounded,
        className
      )}
    >
      <div className='absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_20%,rgba(142,125,255,0.35),transparent_70%),radial-gradient(50%_50%_at_80%_90%,rgba(255,181,71,0.18),transparent_70%)]' />
      <span className='stage-display relative text-[clamp(2.5rem,8vw,5rem)] text-white/90'>
        {initials}
      </span>
    </div>
  );
}

/** Thin progress bar for "how much is left". */
export function ScarcityMeter({ remaining, total }: { remaining: number; total: number }) {
  const left = Math.max(0, Math.min(remaining, total));
  const percentLeft = total > 0 ? Math.round((left / total) * 100) : 0;
  const low = percentLeft <= 25;
  return (
    <div>
      <div className='flex items-baseline justify-between text-xs'>
        <span className={clsx('font-medium', low ? 'text-stage-ember' : 'text-stage-muted')}>
          {left === 0 ? 'None left' : `${left} of ${total} left`}
        </span>
        {low && left > 0 && <span className='font-mono text-stage-ember'>Going fast</span>}
      </div>
      <div
        className='mt-2 h-1 overflow-hidden rounded-full bg-white/10'
        role='progressbar'
        aria-label='Copies left'
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={left}
      >
        <div
          className={clsx('h-full rounded-full', low ? 'bg-stage-ember' : 'bg-stage-pulse')}
          style={{ width: `${percentLeft}%` }}
        />
      </div>
    </div>
  );
}

/** The one primary action style: pulse fill, ink text (contrast 7.9:1). */
export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-control bg-stage-pulse px-5 py-3 text-sm font-semibold text-stage-ink transition-[background-color,transform] duration-200 ease-stage hover:bg-stage-pulse-strong active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-control border border-stage-line-strong bg-white/[0.03] px-5 py-3 text-sm font-semibold text-stage-text transition-colors duration-200 ease-stage hover:border-white/30 hover:bg-white/[0.06]';
