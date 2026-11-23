import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ArtistTile, PartyCard, ReleaseGrid } from './cards';
import { FormatStrip } from './format-strip';
import {
  Artwork,
  Eyebrow,
  formatMoney,
  primaryButton,
  secondaryButton,
  StagePill,
} from './primitives';
import { Countdown } from './time';
import type { StageArtist, StageDrop, StageParty, StageTier } from './types';

export interface CommunityViewProps {
  community: { name: string; description: string | null };
  headliner: StageArtist | null;
  artists: StageArtist[];
  drops: StageDrop[];
  parties: StageParty[];
  /** The headliner's membership, if they offer one. */
  headlinerTier: StageTier | null;
}

interface NextMoment {
  kind: 'drop' | 'party';
  href: string;
  title: string;
  /** Set when the moment is in the future: the hero shows a countdown to it. */
  countdownTo: string | null;
  label: string;
  cta: string;
}

/** The one thing the headliner wants fans to do next: their soonest drop or party. */
function headlinerMoment(
  headliner: StageArtist,
  drops: StageDrop[],
  parties: StageParty[]
): NextMoment | null {
  const drop = drops.find(
    d =>
      d.artistId === headliner.id && !['sold_out', 'ended', 'unavailable'].includes(d.availability)
  );
  const party = parties.find(p => p.artist.id === headliner.id);

  const dropAt =
    drop?.availability === 'not_started' ? (drop.presaleStartsAt ?? drop.startsAt) : null;
  const partyAt = party?.status === 'LIVE' ? null : (party?.scheduledAt ?? null);

  // A drop on sale now beats anything in the future; a live party beats everything.
  if (party?.status === 'LIVE') {
    return {
      kind: 'party',
      href: `/parties/${party.id}`,
      title: party.title,
      countdownTo: null,
      label: 'Live now',
      cta: 'Join the party',
    };
  }
  if (drop && drop.availability !== 'not_started') {
    return {
      kind: 'drop',
      href: `/drops/${drop.id}`,
      title: drop.title,
      countdownTo: null,
      label: drop.availability === 'presale' ? 'Members presale is open' : 'Out now',
      cta:
        drop.availability === 'presale'
          ? 'Get it early'
          : drop.media.kind === 'video'
            ? 'Watch it first'
            : 'Get the drop',
    };
  }
  const candidates: NextMoment[] = [];
  if (drop && dropAt) {
    candidates.push({
      kind: 'drop',
      href: `/drops/${drop.id}`,
      title: drop.title,
      countdownTo: dropAt,
      label: drop.media.kind === 'video' ? 'Premieres in' : 'Drop opens in',
      cta: 'See the drop',
    });
  }
  if (party && partyAt) {
    candidates.push({
      kind: 'party',
      href: `/parties/${party.id}`,
      title: party.title,
      countdownTo: partyAt,
      label: 'Party starts in',
      cta: 'Get a ticket',
    });
  }
  candidates.sort(
    (a, b) => new Date(a.countdownTo ?? 0).getTime() - new Date(b.countdownTo ?? 0).getTime()
  );
  return candidates[0] ?? null;
}

function HeadlinerHero({
  community,
  headliner,
  moment,
  tier,
}: {
  community: CommunityViewProps['community'];
  headliner: StageArtist;
  moment: NextMoment | null;
  tier: StageTier | null;
}) {
  return (
    <section className='stage-grain relative isolate overflow-hidden border-b border-stage-line'>
      {/* Portrait bleeds off the right edge on large screens and sits behind the type on small ones. */}
      <div className='absolute inset-0 -z-10 lg:left-[38%]'>
        <Artwork src={headliner.avatar} name={headliner.displayName} rounded='rounded-none' />
        <div className='absolute inset-0 bg-gradient-to-t from-stage-ink via-stage-ink/70 to-stage-ink/20 lg:bg-gradient-to-r lg:from-stage-ink lg:via-stage-ink/60 lg:to-transparent' />
      </div>
      <div className='stage-spotlight absolute inset-0 -z-10' />

      <div className='mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 lg:min-h-[86vh] lg:px-8 lg:pb-16'>
        <div className='stage-rise flex flex-wrap items-center gap-3'>
          <Eyebrow className='text-stage-muted'>{community.name}</Eyebrow>
          <span aria-hidden className='h-px w-8 bg-stage-line-strong' />
          <StagePill tone='pulse'>Headliner</StagePill>
        </div>

        <h1 className='stage-display stage-rise mt-5 max-w-5xl text-[clamp(4rem,14vw,11rem)] text-stage-text [animation-delay:80ms]'>
          {headliner.displayName}
        </h1>

        {headliner.bio && (
          <p className='stage-rise mt-6 max-w-xl text-base leading-relaxed text-stage-muted sm:text-lg [animation-delay:160ms]'>
            {headliner.bio}
          </p>
        )}

        <div className='stage-rise mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end [animation-delay:240ms]'>
          <div className='flex flex-col gap-3 sm:flex-row'>
            {moment && (
              <Link href={moment.href} className={`${primaryButton} min-h-12 px-6 text-base`}>
                {moment.cta}
                <ArrowRight aria-hidden className='h-4 w-4' />
              </Link>
            )}
            {tier && (
              <Link
                href={`/membership/${headliner.id}`}
                className={`${secondaryButton} min-h-12 px-6 text-base`}
              >
                Join for {formatMoney(tier.price)}/mo
              </Link>
            )}
          </div>

          {moment && (
            <div className='rounded-media border border-stage-line bg-stage-ink/70 p-5 backdrop-blur-md lg:min-w-[22rem]'>
              <p className='truncate text-sm text-stage-muted'>
                <span className='text-stage-text'>{moment.title}</span>
              </p>
              {moment.countdownTo ? (
                <Countdown to={moment.countdownTo} label={moment.label} className='mt-3' />
              ) : (
                <div className='mt-3'>
                  <StagePill
                    tone={moment.kind === 'party' ? 'live' : 'pulse'}
                    live={moment.kind === 'party'}
                  >
                    {moment.label}
                  </StagePill>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='mb-8 flex items-end justify-between gap-4'>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className='mt-2 text-3xl font-bold tracking-tight text-stage-text sm:text-4xl'>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** The community home: the headliner first, then drops, parties and the rest of the roster. */
export function CommunityView({
  community,
  headliner,
  artists,
  drops,
  parties,
  headlinerTier,
}: CommunityViewProps) {
  const others = headliner ? artists.filter(artist => artist.id !== headliner.id) : artists;
  const moment = headliner ? headlinerMoment(headliner, drops, parties) : null;

  return (
    <div className='stage min-h-screen'>
      {headliner ? (
        <HeadlinerHero
          community={community}
          headliner={headliner}
          moment={moment}
          tier={headlinerTier}
        />
      ) : (
        <section className='mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 lg:px-8'>
          <Eyebrow>Community</Eyebrow>
          <h1 className='stage-display mt-4 text-6xl text-stage-text sm:text-8xl'>
            {community.name}
          </h1>
        </section>
      )}

      <FormatStrip />

      {community.description && (
        <section className='border-b border-stage-line'>
          <p className='mx-auto max-w-7xl px-4 py-10 text-xl leading-relaxed text-stage-muted sm:px-6 sm:text-2xl lg:px-8'>
            {community.description}
          </p>
        </section>
      )}

      {drops.length > 0 && (
        <section className='mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24'>
          <SectionHeader eyebrow='Releases' title='Get it before anyone else' />
          <ReleaseGrid drops={drops} />
        </section>
      )}

      {parties.length > 0 && (
        <section className='border-y border-stage-line bg-stage-base'>
          <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8 lg:py-24'>
            <div>
              <Eyebrow>Listening parties and premieres</Eyebrow>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-stage-text sm:text-4xl'>
                Hear it and see it first, together
              </h2>
              <p className='mt-4 max-w-md text-stage-muted'>
                New music and new film, premiered live by the artist, with chat. Ticket holders get
                a reminder an hour before doors.
              </p>
            </div>
            <ul className='space-y-3'>
              {parties.map(party => (
                <li key={party.id}>
                  <PartyCard party={party} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className='mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24'>
          <SectionHeader eyebrow='The roster' title='Also on the bill' />
          <ul className='grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4'>
            {others.map(artist => (
              <li key={artist.id}>
                <ArtistTile artist={artist} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {drops.length === 0 && parties.length === 0 && (
        <section className='mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8'>
          <p className='text-stage-muted'>The first release is on its way. Check back soon.</p>
        </section>
      )}
    </div>
  );
}
