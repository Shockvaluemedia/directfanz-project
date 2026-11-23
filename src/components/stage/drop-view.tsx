import Link from 'next/link';
import { ArrowLeft, Check, Clock, Layers } from 'lucide-react';
import { DropBuyPanel, MembershipJoinButton } from './checkout';
import { DropPrice } from './cards';
import {
  Artwork,
  AVAILABILITY,
  Eyebrow,
  formatMoney,
  ScarcityMeter,
  StagePill,
} from './primitives';
import { Countdown, LocalTime } from './time';
import { isPayWhatYouWant, type StageDrop, type StageTier, type StageViewer } from './types';

export interface DropViewProps {
  drop: StageDrop;
  artistAvatar: string | null;
  viewer: StageViewer & { isMember: boolean };
  owned: boolean;
  /** The artist's membership, offered when it unlocks this drop early or cheaper. */
  tier: StageTier | null;
}

function MemberStrip({
  drop,
  tier,
  viewer,
}: {
  drop: StageDrop;
  tier: StageTier;
  viewer: DropViewProps['viewer'];
}) {
  const perks = [
    drop.presaleStartsAt ? 'Get in before the public sale' : null,
    drop.memberPrice !== null
      ? `Pay ${formatMoney(drop.memberPrice)} instead of ${formatMoney(drop.price)}`
      : null,
  ].filter(Boolean) as string[];
  if (perks.length === 0) return null;
  return (
    <div className='rounded-media border border-stage-ember/30 bg-stage-ember/[0.06] p-5'>
      <div className='flex items-center justify-between gap-3'>
        <p className='font-semibold text-stage-text'>{tier.name}</p>
        <p className='stage-figures text-sm text-stage-ember'>{formatMoney(tier.price)}/month</p>
      </div>
      <ul className='mt-3 space-y-1.5'>
        {perks.map(perk => (
          <li key={perk} className='flex items-center gap-2 text-sm text-stage-muted'>
            <Check aria-hidden className='h-4 w-4 text-stage-ember' />
            {perk}
          </li>
        ))}
      </ul>
      <MembershipJoinButton tierId={tier.id} price={tier.price} viewer={viewer} className='mt-4' />
    </div>
  );
}

/** Everything in the buy column, by state. */
function BuyArea({ drop, viewer, owned, tier }: Omit<DropViewProps, 'artistAvatar'>) {
  const minimum = viewer.isMember && drop.memberPrice !== null ? drop.memberPrice : drop.price;

  if (owned) {
    return (
      <div className='rounded-media border border-stage-pulse/30 bg-stage-pulse/[0.06] p-5'>
        <p className='flex items-center gap-2 font-semibold text-stage-pulse'>
          <Check aria-hidden className='h-5 w-5' /> It&apos;s yours
        </p>
        <p className='mt-2 text-sm text-stage-muted'>
          Everything in this drop is unlocked on your account.
        </p>
        <Link
          href='/dashboard/fan'
          className='mt-4 inline-block text-sm font-semibold text-stage-text underline-offset-4 hover:underline'
        >
          Go to your library
        </Link>
      </div>
    );
  }

  switch (drop.availability) {
    case 'on_sale':
      return (
        <DropBuyPanel
          dropId={drop.id}
          artistName={drop.artistName}
          payWhatYouWant={isPayWhatYouWant(drop)}
          minimum={minimum}
          viewer={viewer}
        />
      );
    case 'presale':
      return viewer.isMember ? (
        <div className='space-y-4'>
          <StagePill tone='ember'>You&apos;re in early</StagePill>
          <DropBuyPanel
            dropId={drop.id}
            artistName={drop.artistName}
            payWhatYouWant={isPayWhatYouWant(drop)}
            minimum={minimum}
            viewer={viewer}
            buyLabel='Buy in presale'
          />
        </div>
      ) : (
        <div className='space-y-4'>
          <p className='text-stage-muted'>
            Members are buying now. Everyone else can buy from{' '}
            <LocalTime iso={drop.startsAt} className='text-stage-text' />.
          </p>
          {tier && <MemberStrip drop={drop} tier={tier} viewer={viewer} />}
        </div>
      );
    case 'not_started':
      return (
        <div className='space-y-4'>
          <p className='text-stage-muted'>
            {drop.presaleStartsAt ? 'Members get in first. ' : ''}Come back when the timer hits
            zero.
          </p>
          {tier && !viewer.isMember && <MemberStrip drop={drop} tier={tier} viewer={viewer} />}
        </div>
      );
    case 'sold_out':
    case 'ended':
      return (
        <div className='rounded-media border border-stage-line bg-white/[0.02] p-5'>
          <p className='font-semibold text-stage-text'>
            {drop.availability === 'sold_out'
              ? 'Every copy found a home.'
              : 'This drop has closed.'}
          </p>
          <p className='mt-2 text-sm text-stage-muted'>
            Follow along on the community page so you catch the next one.
          </p>
          <Link
            href='/community'
            className='mt-4 inline-block text-sm font-semibold text-stage-pulse underline-offset-4 hover:underline'
          >
            See what&apos;s next
          </Link>
        </div>
      );
    default:
      return <p className='text-stage-muted'>This drop isn&apos;t available right now.</p>;
  }
}

function TimerFor({ drop }: { drop: StageDrop }) {
  if (drop.availability === 'not_started') {
    return (
      <Countdown
        to={drop.presaleStartsAt ?? drop.startsAt}
        label={drop.presaleStartsAt ? 'Members presale opens in' : 'Opens in'}
        size='lg'
      />
    );
  }
  if (drop.availability === 'presale') {
    return <Countdown to={drop.startsAt} label='Public sale in' size='lg' />;
  }
  if (drop.availability === 'on_sale' && drop.endsAt) {
    return <Countdown to={drop.endsAt} label='Closes in' size='lg' doneText='Closed' />;
  }
  return null;
}

/** A single drop: artwork on the left, the decision on the right. */
export function DropView({ drop, artistAvatar, viewer, owned, tier }: DropViewProps) {
  const status = AVAILABILITY[drop.availability];
  const buyable =
    !owned &&
    (drop.availability === 'on_sale' || (drop.availability === 'presale' && viewer.isMember));

  return (
    <div className='stage relative min-h-screen [&:has(.stage-buybar)]:pb-24 lg:[&:has(.stage-buybar)]:pb-0'>
      <div className='stage-spotlight pointer-events-none absolute inset-x-0 top-0 h-[60vh]' />
      <div className='relative mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8'>
        <Link
          href='/community'
          className='inline-flex min-h-11 items-center gap-2 text-sm text-stage-muted hover:text-stage-text'
        >
          <ArrowLeft aria-hidden className='h-4 w-4' /> Community
        </Link>

        <div className='mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16'>
          <div className='lg:sticky lg:top-24 lg:self-start'>
            <div className='relative aspect-square overflow-hidden rounded-media border border-stage-line shadow-[0_40px_120px_-40px_rgba(142,125,255,0.45)]'>
              <Artwork
                src={drop.artwork ?? artistAvatar}
                name={drop.title}
                rounded='rounded-none'
              />
            </div>
          </div>

          <div className='stage-rise'>
            <div className='flex flex-wrap items-center gap-3'>
              <StagePill tone={status.tone}>{status.label}</StagePill>
              {isPayWhatYouWant(drop) && <StagePill>Name your price</StagePill>}
            </div>

            <Eyebrow className='mt-6'>{drop.artistName}</Eyebrow>
            <h1 className='stage-display mt-3 text-[clamp(2.75rem,6vw,5rem)] text-stage-text'>
              {drop.title}
            </h1>

            <div className='mt-6'>
              <DropPrice drop={drop} size='lg' />
            </div>

            <div className='mt-8'>
              <TimerFor drop={drop} />
            </div>

            {drop.quantityLimit !== null &&
              drop.remaining !== null &&
              drop.availability !== 'ended' && (
                <div className='mt-8 max-w-md'>
                  <ScarcityMeter remaining={drop.remaining} total={drop.quantityLimit} />
                </div>
              )}

            <div id='buy' className='mt-10 max-w-md scroll-mt-24'>
              <BuyArea drop={drop} viewer={viewer} owned={owned} tier={tier} />
            </div>

            <dl className='mt-12 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-media border border-stage-line bg-stage-line text-sm'>
              <div className='bg-stage-surface p-4'>
                <dt className='flex items-center gap-2 text-stage-subtle'>
                  <Layers aria-hidden className='h-4 w-4' /> In this drop
                </dt>
                <dd className='mt-1 font-semibold text-stage-text'>
                  {drop.itemCount > 0
                    ? `${drop.itemCount} ${drop.itemCount === 1 ? 'item' : 'items'}, yours to keep`
                    : 'Yours to keep'}
                </dd>
              </div>
              <div className='bg-stage-surface p-4'>
                <dt className='flex items-center gap-2 text-stage-subtle'>
                  <Clock aria-hidden className='h-4 w-4' />{' '}
                  {drop.availability === 'not_started' || drop.availability === 'presale'
                    ? 'Public sale'
                    : 'Released'}
                </dt>
                <dd className='mt-1 font-semibold text-stage-text'>
                  <LocalTime iso={drop.startsAt} />
                </dd>
              </div>
            </dl>

            {drop.description && (
              <div className='mt-12 max-w-xl'>
                <Eyebrow>About this drop</Eyebrow>
                <p className='mt-3 whitespace-pre-line leading-relaxed text-stage-muted'>
                  {drop.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {buyable && (
        <div className='stage-buybar fixed inset-x-0 bottom-0 z-30 border-t border-stage-line bg-stage-ink/90 px-4 py-3 backdrop-blur-md lg:hidden'>
          <div className='mx-auto flex max-w-7xl items-center justify-between gap-4'>
            <div className='min-w-0'>
              <p className='truncate text-sm font-semibold text-stage-text'>{drop.title}</p>
              <p className='stage-figures text-xs text-stage-muted'>
                {isPayWhatYouWant(drop) ? 'From ' : ''}
                {formatMoney(
                  viewer.isMember && drop.memberPrice !== null ? drop.memberPrice : drop.price
                )}
              </p>
            </div>
            <a
              href='#buy'
              className='inline-flex min-h-11 items-center rounded-control bg-stage-pulse px-5 text-sm font-semibold text-stage-ink'
            >
              Buy
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
