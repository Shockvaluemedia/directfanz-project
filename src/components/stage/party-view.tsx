import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bell, Check, MessageCircle, Radio } from 'lucide-react';
import { TicketBuyPanel } from './checkout';
import { Artwork, Eyebrow, formatMoney, primaryButton, StagePill } from './primitives';
import { Countdown, LocalTime } from './time';
import type { StageParty, StageViewer } from './types';

export interface PartyViewProps {
  party: StageParty;
  artistAvatar: string | null;
  viewer: StageViewer;
  hasTicket: boolean;
  canWatch: boolean;
}

const INCLUDED = [
  { icon: Radio, text: 'The premiere, live, hosted by the artist' },
  { icon: MessageCircle, text: 'Chat with the artist and everyone in the room' },
  { icon: Bell, text: 'An email reminder an hour before doors' },
];

function EntryArea({ party, viewer, hasTicket, canWatch }: Omit<PartyViewProps, 'artistAvatar'>) {
  const live = party.status === 'LIVE';
  const ended = party.status === 'ENDED' || party.status === 'CANCELLED';
  const price = Number(party.price);

  if (ended) {
    return (
      <div className='rounded-media border border-stage-line bg-white/[0.02] p-5'>
        <p className='font-semibold text-stage-text'>This party has wrapped.</p>
        <Link
          href='/community'
          className='mt-3 inline-block text-sm font-semibold text-stage-pulse underline-offset-4 hover:underline'
        >
          See upcoming parties
        </Link>
      </div>
    );
  }

  if (canWatch || hasTicket) {
    return (
      <div className='space-y-4'>
        <p className='flex items-center gap-2 font-semibold text-stage-pulse'>
          <Check aria-hidden className='h-5 w-5' /> You&apos;re on the list
        </p>
        {live ? (
          <Link
            href={`/stream/${party.id}`}
            className={`${primaryButton} min-h-12 w-full text-base`}
          >
            Enter the party <ArrowRight aria-hidden className='h-4 w-4' />
          </Link>
        ) : (
          <p className='text-sm text-stage-muted'>
            Doors open here at the start time. We&apos;ll email you an hour before.
          </p>
        )}
      </div>
    );
  }

  return (
    <TicketBuyPanel
      streamId={party.id}
      artistName={party.artist.displayName}
      price={price}
      viewer={viewer}
    />
  );
}

/** A listening party: pre-show countdown, then a live state that points into the room. */
export function PartyView({ party, artistAvatar, viewer, hasTicket, canWatch }: PartyViewProps) {
  const live = party.status === 'LIVE';
  return (
    <div className='stage min-h-screen'>
      <section className='stage-grain relative isolate overflow-hidden border-b border-stage-line'>
        <div className='absolute inset-0 -z-10'>
          <Artwork
            src={party.thumbnailUrl ?? artistAvatar}
            name={party.artist.displayName}
            rounded='rounded-none'
            className='scale-105 blur-sm motion-reduce:transform-none'
          />
          <div className='absolute inset-0 bg-stage-ink/80' />
          <div className='absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,77,106,0.18),transparent_70%)]' />
        </div>

        <div className='mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8 lg:pb-20'>
          <Link
            href='/community'
            className='inline-flex min-h-11 items-center gap-2 text-sm text-stage-muted hover:text-stage-text'
          >
            <ArrowLeft aria-hidden className='h-4 w-4' /> Community
          </Link>

          <div className='mt-10 grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-end'>
            <div className='stage-rise'>
              <div className='flex flex-wrap items-center gap-3'>
                {live ? (
                  <StagePill tone='live' live>
                    Live now
                  </StagePill>
                ) : (
                  <StagePill tone='ember'>Listening party</StagePill>
                )}
                <StagePill>{formatMoney(party.price)} ticket</StagePill>
              </div>
              <Eyebrow className='mt-6'>{party.artist.displayName} presents</Eyebrow>
              <h1 className='stage-display mt-3 text-[clamp(3rem,8vw,6.5rem)] text-stage-text'>
                {party.title}
              </h1>
              {party.scheduledAt && (
                <p className='mt-6 text-lg text-stage-muted'>
                  <LocalTime iso={party.scheduledAt} />
                </p>
              )}
              {!live && party.scheduledAt && (
                <Countdown
                  to={party.scheduledAt}
                  label='Doors in'
                  size='lg'
                  doneText='Starting'
                  className='mt-10'
                />
              )}
            </div>

            <div className='rounded-media border border-stage-line bg-stage-ink/75 p-6 backdrop-blur-md'>
              <EntryArea party={party} viewer={viewer} hasTicket={hasTicket} canWatch={canWatch} />
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8'>
        <div>
          <Eyebrow>What your ticket gets you</Eyebrow>
          <ul className='mt-6 space-y-4'>
            {INCLUDED.map(({ icon: Icon, text }) => (
              <li key={text} className='flex items-start gap-4'>
                <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-stage-line bg-stage-surface'>
                  <Icon aria-hidden className='h-5 w-5 text-stage-pulse' />
                </span>
                <span className='pt-2 text-stage-text'>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        {party.description && (
          <div>
            <Eyebrow>About the party</Eyebrow>
            <p className='mt-6 whitespace-pre-line leading-relaxed text-stage-muted'>
              {party.description}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
