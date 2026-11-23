'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
};

/**
 * A date in the fan's own time zone. The server renders it in UTC, then the
 * browser swaps in local time after it loads.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState(() =>
    new Date(iso).toLocaleString('en-US', { ...DATE_OPTIONS, timeZone: 'UTC' })
  );
  useEffect(() => {
    setText(new Date(iso).toLocaleString('en-US', DATE_OPTIONS));
  }, [iso]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Countdown to a moment. Digits are tabular so nothing jumps; the visible
 * seconds tick but screen readers get one calm summary, not a ticking stream.
 */
export function Countdown({
  to,
  label,
  size = 'md',
  doneText = 'Now',
  className,
}: {
  to: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  doneText?: string;
  className?: string;
}) {
  const target = new Date(to).getTime();
  // Rendered on the server too, so the page shows real numbers before scripts
  // load; the browser's first tick corrects any drift.
  const [now, setNow] = useState<number | null>(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = now === null ? null : target - now;
  const p = parts(remaining ?? 0);
  const units: Array<[string, string]> = [
    [p.days > 99 ? String(p.days) : pad(p.days), 'days'],
    [pad(p.hours), 'hrs'],
    [pad(p.minutes), 'min'],
    [pad(p.seconds), 'sec'],
  ];

  const summary =
    remaining === null
      ? label
      : remaining <= 0
        ? `${label}: ${doneText}`
        : `${label}: ${p.days} days, ${p.hours} hours, ${p.minutes} minutes`;

  const digit = {
    sm: 'text-lg',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-4xl sm:text-5xl',
  }[size];

  return (
    <div
      role='timer'
      aria-label={summary}
      data-countdown-to={to}
      className={clsx('stage-figures', className)}
      suppressHydrationWarning
    >
      <p className='font-mono text-[11px] uppercase tracking-[0.22em] text-stage-subtle'>{label}</p>
      {remaining !== null && remaining <= 0 ? (
        <p aria-hidden className={clsx('mt-1 font-mono font-semibold text-stage-pulse', digit)}>
          {doneText}
        </p>
      ) : (
        <div aria-hidden className='mt-1 flex items-end gap-3 sm:gap-4'>
          {units.map(([value, unit], index) => (
            <div key={unit} className='flex items-end gap-3 sm:gap-4'>
              <div>
                <span
                  data-unit={unit}
                  suppressHydrationWarning
                  className={clsx('block font-mono font-semibold text-stage-text', digit)}
                >
                  {remaining === null ? '--' : value}
                </span>
                <span className='block font-mono text-[10px] uppercase tracking-[0.18em] text-stage-subtle'>
                  {unit}
                </span>
              </div>
              {index < units.length - 1 && (
                <span className={clsx('pb-4 font-mono text-stage-line-strong', digit)}>:</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
