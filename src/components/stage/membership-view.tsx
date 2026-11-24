import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { PartyCard, ReleaseGrid } from './cards';
import { MembershipJoinButton } from './checkout';
import { Artwork, Eyebrow, formatMoney, StagePill } from './primitives';
import type { StageArtist, StageDrop, StageParty, StageTier, StageViewer } from './types';

export interface MembershipViewProps {
  artist: StageArtist;
  tier: StageTier | null;
  viewer: StageViewer & { isMember: boolean };
  drops: StageDrop[];
  parties: StageParty[];
}

/**
 * The membership is sold as a backstage pass, not a pricing card: one tier,
 * shaped like a ticket, with perks the app actually enforces.
 */
function Pass({
  artist,
  tier,
  viewer,
}: {
  artist: StageArtist;
  tier: StageTier;
  viewer: MembershipViewProps['viewer'];
}) {
  const perks = [
    'Early access to every release, music and video',
    'Member pricing on drops when the artist sets it',
    'Directly supports the artist every month',
  ];
  return (
    <div className='relative overflow-hidden rounded-media border border-stage-line-strong bg-stage-surface'>
      <div className='absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-stage-pulse to-stage-ember' />
      <div className='p-6 sm:p-8'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <Eyebrow>Membership</Eyebrow>
            <p className='mt-2 text-2xl font-bold text-stage-text'>{tier.name}</p>
          </div>
          <StagePill tone='pulse'>{artist.displayName}</StagePill>
        </div>
        <p className='stage-figures mt-8 text-6xl font-semibold tracking-tight text-stage-text'>
          {formatMoney(tier.price)}
          <span className='ml-1 text-base font-medium text-stage-muted'>/ month</span>
        </p>
        {tier.description && <p className='mt-4 text-stage-muted'>{tier.description}</p>}
      </div>

      {/* Perforation: the stub line of a ticket. */}
      <div aria-hidden className='relative flex items-center'>
        <span className='absolute -left-3 h-6 w-6 rounded-full bg-stage-ink' />
        <span className='mx-6 w-full border-t border-dashed border-stage-line-strong' />
        <span className='absolute -right-3 h-6 w-6 rounded-full bg-stage-ink' />
      </div>

      <div className='p-6 sm:p-8'>
        <ul className='space-y-3'>
          {perks.map(perk => (
            <li key={perk} className='flex items-start gap-3 text-stage-text'>
              <Check aria-hidden className='mt-0.5 h-5 w-5 shrink-0 text-stage-pulse' />
              {perk}
            </li>
          ))}
        </ul>
        <div className='mt-8'>
          {viewer.isMember ? (
            <p className='flex items-center gap-2 font-semibold text-stage-pulse'>
              <Check aria-hidden className='h-5 w-5' /> You&apos;re a member
            </p>
          ) : (
            <MembershipJoinButton tierId={tier.id} price={tier.price} viewer={viewer} />
          )}
        </div>
      </div>
    </div>
  );
}

export function MembershipView({ artist, tier, viewer, drops, parties }: MembershipViewProps) {
  return (
    <div className='stage relative min-h-screen'>
      <div className='stage-spotlight pointer-events-none absolute inset-x-0 top-0 h-[70vh]' />
      <div className='relative mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8'>
        <Link
          href='/community'
          className='inline-flex min-h-11 items-center gap-2 text-sm text-stage-muted hover:text-stage-text'
        >
          <ArrowLeft aria-hidden className='h-4 w-4' /> Community
        </Link>

        <div className='mt-8 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16'>
          <div className='stage-rise'>
            <div className='h-28 w-28 overflow-hidden rounded-full border border-stage-line-strong sm:h-36 sm:w-36'>
              <Artwork src={artist.avatar} name={artist.displayName} rounded='rounded-full' />
            </div>
            <Eyebrow className='mt-8'>Backstage with</Eyebrow>
            <h1 className='stage-display mt-3 text-[clamp(3.5rem,9vw,8rem)] text-stage-text'>
              {artist.displayName}
            </h1>
            {artist.bio && (
              <p className='mt-6 max-w-lg text-lg leading-relaxed text-stage-muted'>{artist.bio}</p>
            )}
          </div>

          <div>
            {tier ? (
              <Pass artist={artist} tier={tier} viewer={viewer} />
            ) : (
              <div className='rounded-media border border-stage-line bg-stage-surface p-8'>
                <Eyebrow>Membership</Eyebrow>
                <p className='mt-3 text-xl font-semibold text-stage-text'>Opening soon</p>
                <p className='mt-2 text-stage-muted'>
                  {artist.displayName} hasn&apos;t opened a membership yet. Drops and parties below
                  are open to everyone.
                </p>
              </div>
            )}
          </div>
        </div>

        {drops.length > 0 && (
          <section className='mt-24'>
            <Eyebrow>Releases</Eyebrow>
            <div className='mt-6'>
              <ReleaseGrid drops={drops} />
            </div>
          </section>
        )}

        {parties.length > 0 && (
          <section className='mt-16'>
            <Eyebrow>Listening parties and premieres</Eyebrow>
            <ul className='mt-6 grid gap-3 lg:grid-cols-2'>
              {parties.map(party => (
                <li key={party.id}>
                  <PartyCard party={party} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
