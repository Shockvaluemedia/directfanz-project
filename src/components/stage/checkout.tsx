'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Lock } from 'lucide-react';
import { formatMoney, primaryButton, secondaryButton } from './primitives';
import type { StageViewer } from './types';

/**
 * The buy buttons. They only call the checkout routes that already exist:
 * POST /api/payments/purchase-checkout (drops, party tickets) and
 * POST /api/payments/create-checkout (membership). Prices are always decided
 * by the server; the amount sent here is only the fan's pay-what-you-want pick.
 */

type CheckoutRequest =
  | { kind: 'purchase'; itemType: 'DROP' | 'LIVE_STREAM_TICKET'; itemId: string }
  | { kind: 'membership'; tierId: string };

async function startCheckout(
  request: CheckoutRequest,
  options: { amount?: number; joinFanList?: boolean }
): Promise<string> {
  const response =
    request.kind === 'purchase'
      ? await fetch('/api/payments/purchase-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemType: request.itemType,
            itemId: request.itemId,
            ...(options.amount !== undefined ? { amount: options.amount } : {}),
            ...(options.joinFanList ? { joinFanList: true } : {}),
          }),
        })
      : await fetch('/api/payments/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tierId: request.tierId, amount: options.amount }),
        });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.checkoutUrl !== 'string') {
    throw new Error(
      typeof body.error === 'string' ? body.error : 'Checkout could not start. Try again.'
    );
  }
  return body.checkoutUrl;
}

function useCheckout(request: CheckoutRequest) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (options: { amount?: number; joinFanList?: boolean }) => {
    setPending(true);
    setError(null);
    try {
      const url = await startCheckout(request, options);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout could not start. Try again.');
      setPending(false);
    }
  };
  return { pending, error, go };
}

/** What a visitor who can't buy yet sees in place of the button. */
function ViewerGate({ viewer, verb }: { viewer: StageViewer; verb: string }) {
  const pathname = usePathname();
  if (!viewer.signedIn) {
    const callback = encodeURIComponent(pathname ?? '/community');
    return (
      <div className='grid gap-2 sm:grid-cols-2'>
        <Link href={`/auth/signin?callbackUrl=${callback}`} className={primaryButton}>
          Sign in to {verb}
        </Link>
        <Link href={`/auth/signup?role=fan&callbackUrl=${callback}`} className={secondaryButton}>
          Create a fan account
        </Link>
      </div>
    );
  }
  return (
    <p className='rounded-control border border-stage-line bg-white/[0.02] px-4 py-3 text-sm text-stage-muted'>
      Purchases are made from a fan account.
    </p>
  );
}

function SecureNote() {
  return (
    <p className='flex items-center gap-2 text-xs text-stage-subtle'>
      <Lock aria-hidden className='h-3.5 w-3.5' />
      Secure checkout by Stripe. You can review everything before you pay.
    </p>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role='alert' className='text-sm text-stage-live'>
      {error}
    </p>
  );
}

function FanListOptIn({
  checked,
  onChange,
  artistName,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  artistName: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className='flex cursor-pointer items-start gap-3 text-sm text-stage-muted'>
      <input
        id={id}
        type='checkbox'
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className='mt-0.5 h-4 w-4 rounded border-stage-line-strong bg-transparent text-stage-pulse focus:ring-stage-pulse'
      />
      <span>Email me when {artistName} drops something new. Unsubscribe any time.</span>
    </label>
  );
}

/** Buy a drop: fixed price, or pay what you want above a minimum. */
export function DropBuyPanel({
  dropId,
  artistName,
  payWhatYouWant,
  minimum,
  viewer,
  buyLabel = 'Buy now',
}: {
  dropId: string;
  artistName: string;
  payWhatYouWant: boolean;
  /** Dollars: the price, or the minimum for pay what you want. */
  minimum: number;
  viewer: StageViewer;
  buyLabel?: string;
}) {
  const { pending, error, go } = useCheckout({
    kind: 'purchase',
    itemType: 'DROP',
    itemId: dropId,
  });
  const [amountText, setAmountText] = useState(minimum.toFixed(2));
  const [joinFanList, setJoinFanList] = useState(false);
  const inputId = useId();
  const hintId = useId();

  const amount = Number(amountText);
  const amountOk = !payWhatYouWant || (Number.isFinite(amount) && amount >= minimum);
  const picks = useMemo(
    () => [minimum, minimum + 5, minimum + 10].map(v => Math.round(v * 100) / 100),
    [minimum]
  );

  if (!viewer.signedIn || !viewer.isFan) return <ViewerGate viewer={viewer} verb='buy' />;

  return (
    <form
      className='space-y-4'
      onSubmit={event => {
        event.preventDefault();
        if (!amountOk || pending) return;
        void go({ amount: payWhatYouWant ? amount : undefined, joinFanList });
      }}
    >
      {payWhatYouWant && (
        <div>
          <label htmlFor={inputId} className='text-sm font-medium text-stage-text'>
            Name your price
          </label>
          <div className='mt-2 flex flex-wrap gap-2' role='group' aria-label='Suggested amounts'>
            {picks.map(pick => (
              <button
                key={pick}
                type='button'
                onClick={() => setAmountText(pick.toFixed(2))}
                aria-pressed={Number(amountText) === pick}
                className={clsx(
                  'min-h-11 rounded-control border px-4 font-mono text-sm transition-colors',
                  Number(amountText) === pick
                    ? 'border-stage-pulse bg-stage-pulse/10 text-stage-pulse'
                    : 'border-stage-line-strong text-stage-muted hover:border-white/30 hover:text-stage-text'
                )}
              >
                {formatMoney(pick)}
              </button>
            ))}
          </div>
          <div className='relative mt-3'>
            <span className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-stage-subtle'>
              $
            </span>
            <input
              id={inputId}
              inputMode='decimal'
              aria-describedby={hintId}
              aria-invalid={!amountOk}
              value={amountText}
              onChange={event => setAmountText(event.target.value.replace(/[^0-9.]/g, ''))}
              className='stage-figures min-h-12 w-full rounded-control border border-stage-line-strong bg-stage-ink pl-8 pr-4 font-mono text-lg text-stage-text outline-none focus:border-stage-pulse'
            />
          </div>
          <p
            id={hintId}
            className={clsx('mt-2 text-xs', amountOk ? 'text-stage-subtle' : 'text-stage-live')}
          >
            Minimum {formatMoney(minimum)}. Anything above goes straight to {artistName}.
          </p>
        </div>
      )}
      <FanListOptIn checked={joinFanList} onChange={setJoinFanList} artistName={artistName} />
      <button
        type='submit'
        disabled={!amountOk || pending}
        className={clsx(primaryButton, 'w-full min-h-12 text-base')}
      >
        {pending
          ? 'Opening checkout...'
          : payWhatYouWant
            ? `${buyLabel} · ${formatMoney(amountOk ? amount : minimum)}`
            : `${buyLabel} · ${formatMoney(minimum)}`}
      </button>
      <ErrorLine error={error} />
      <SecureNote />
    </form>
  );
}

/** Buy a ticket to a listening party. */
export function TicketBuyPanel({
  streamId,
  artistName,
  price,
  viewer,
}: {
  streamId: string;
  artistName: string;
  price: number;
  viewer: StageViewer;
}) {
  const { pending, error, go } = useCheckout({
    kind: 'purchase',
    itemType: 'LIVE_STREAM_TICKET',
    itemId: streamId,
  });
  const [joinFanList, setJoinFanList] = useState(false);

  if (!viewer.signedIn || !viewer.isFan) return <ViewerGate viewer={viewer} verb='get a ticket' />;

  return (
    <div className='space-y-4'>
      <FanListOptIn checked={joinFanList} onChange={setJoinFanList} artistName={artistName} />
      <button
        type='button'
        disabled={pending}
        onClick={() => void go({ joinFanList })}
        className={clsx(primaryButton, 'w-full min-h-12 text-base')}
      >
        {pending ? 'Opening checkout...' : `Get a ticket · ${formatMoney(price)}`}
      </button>
      <ErrorLine error={error} />
      <SecureNote />
    </div>
  );
}

/** Join an artist's membership (one monthly tier). */
export function MembershipJoinButton({
  tierId,
  price,
  viewer,
  className,
}: {
  tierId: string;
  price: number;
  viewer: StageViewer;
  className?: string;
}) {
  const { pending, error, go } = useCheckout({ kind: 'membership', tierId });
  if (!viewer.signedIn || !viewer.isFan) return <ViewerGate viewer={viewer} verb='join' />;
  return (
    <div className={clsx('space-y-3', className)}>
      <button
        type='button'
        disabled={pending}
        onClick={() => void go({ amount: price })}
        className={clsx(primaryButton, 'w-full min-h-12 text-base')}
      >
        {pending ? 'Opening checkout...' : `Join for ${formatMoney(price)}/month`}
      </button>
      <ErrorLine error={error} />
      <p className='text-xs text-stage-subtle'>Cancel any time. Billed monthly by Stripe.</p>
    </div>
  );
}
