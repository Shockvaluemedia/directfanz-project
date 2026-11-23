import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CommunityView } from '@/components/stage/community-view';
import { DropView } from '@/components/stage/drop-view';
import { PartyView } from '@/components/stage/party-view';
import { MembershipView } from '@/components/stage/membership-view';
import type { StageArtist, StageDrop, StageParty, StageTier } from '@/components/stage/types';

export const dynamic = 'force-dynamic';

/**
 * Design preview: the stage pages rendered from made-up sample data, with no
 * database and no buttons that reach Stripe (the sample ids don't exist).
 * Off in production unless DESIGN_PREVIEW=on is set.
 */

const hour = 60 * 60 * 1000;
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * hour).toISOString();

const nahvee: StageArtist = {
  id: 'sample-nahvee',
  displayName: 'Nahvee',
  avatar: null,
  bio: 'Sample bio. The new single drops here first, before it reaches any streaming service.',
};
const neverMore: StageArtist = {
  id: 'sample-never-more',
  displayName: 'Never More',
  avatar: null,
  bio: null,
};
const roster: StageArtist[] = [
  nahvee,
  neverMore,
  { id: 'sample-a3', displayName: 'Sample Artist', avatar: null, bio: null },
  { id: 'sample-a4', displayName: 'Another Act', avatar: null, bio: null },
];

const tier: StageTier = {
  id: 'sample-tier',
  name: 'Inner Circle',
  description: 'Sample tier description written by the artist.',
  price: 3,
};

const baseDrop: StageDrop = {
  id: 'sample-drop',
  artistId: nahvee.id,
  artistName: 'Nahvee',
  title: 'Sample Single',
  description: 'Sample description. The single, the instrumental and a voice note from the studio.',
  priceType: 'PAY_WHAT_YOU_WANT',
  price: 5,
  memberPrice: 4,
  memberDiscountPercent: 20,
  startsAt: at(26),
  presaleStartsAt: at(-2),
  endsAt: at(24 * 14),
  quantityLimit: 500,
  remaining: 112,
  itemCount: 3,
  availability: 'presale',
  artwork: null,
  media: { kind: 'music', format: 'Single', poster: null, runtimeSeconds: null, previewUrl: null },
};

const videoDrop: StageDrop = {
  ...baseDrop,
  id: 'sample-video',
  artistId: neverMore.id,
  artistName: 'Never More',
  title: 'Sample Short Film',
  description:
    'Sample description. A short film shot around the single, with a behind-the-scenes cut.',
  priceType: 'FIXED',
  price: 8,
  memberPrice: 6,
  memberDiscountPercent: 25,
  presaleStartsAt: null,
  startsAt: at(-20),
  quantityLimit: null,
  remaining: null,
  itemCount: 2,
  availability: 'on_sale',
  media: {
    kind: 'video',
    format: 'Short',
    poster: null,
    runtimeSeconds: 14 * 60,
    previewUrl: null,
  },
};

const documentary: StageDrop = {
  ...baseDrop,
  id: 'sample-documentary',
  title: 'Sample Documentary',
  description: 'Sample description. A year in the studio, ahead of the debut project.',
  priceType: 'FIXED',
  price: 12,
  memberPrice: 9,
  memberDiscountPercent: 25,
  presaleStartsAt: at(24 * 5),
  startsAt: at(24 * 7),
  quantityLimit: null,
  remaining: null,
  itemCount: 1,
  availability: 'not_started',
  media: {
    kind: 'video',
    format: 'Documentary',
    poster: null,
    runtimeSeconds: 52 * 60,
    previewUrl: null,
  },
};

const drops: StageDrop[] = [
  baseDrop,
  {
    ...baseDrop,
    id: 'sample-drop-2',
    artistId: neverMore.id,
    artistName: 'Never More',
    title: 'Second Sample',
    priceType: 'FIXED',
    media: { ...baseDrop.media, format: 'Project' },
    price: 7,
    memberPrice: null,
    memberDiscountPercent: null,
    presaleStartsAt: null,
    startsAt: at(24 * 9),
    quantityLimit: null,
    remaining: null,
    availability: 'not_started',
  },
  {
    ...baseDrop,
    id: 'sample-drop-3',
    title: 'Earlier Sample',
    availability: 'sold_out',
    remaining: 0,
    quantityLimit: 250,
  },
  videoDrop,
  documentary,
];

const parties: StageParty[] = [
  {
    id: 'sample-party',
    title: 'Sample Single Release Night',
    description:
      'Sample description. Nahvee plays the single for the first time and takes questions in chat.',
    status: 'SCHEDULED',
    scheduledAt: at(50),
    thumbnailUrl: null,
    price: '10.00',
    artist: { id: nahvee.id, displayName: 'Nahvee' },
  },
  {
    id: 'sample-party-2',
    title: 'Sample Studio Session',
    description: null,
    status: 'SCHEDULED',
    scheduledAt: at(24 * 12),
    thumbnailUrl: null,
    price: '5.00',
    artist: { id: neverMore.id, displayName: 'Never More' },
  },
];

const fan = { signedIn: true, isFan: true };

const VIEWS: Record<string, { label: string; render: () => React.ReactNode }> = {
  community: {
    label: 'Community home',
    render: () => (
      <CommunityView
        community={{
          name: 'Sample Community',
          description:
            'Sample community description: one roster, music and film before streaming, release-night premieres.',
        }}
        headliner={nahvee}
        artists={roster}
        drops={drops}
        parties={parties}
        headlinerTier={tier}
      />
    ),
  },
  'drop-presale': {
    label: 'Drop, presale (not a member)',
    render: () => (
      <DropView
        drop={baseDrop}
        artistAvatar={null}
        viewer={{ ...fan, isMember: false }}
        owned={false}
        tier={tier}
      />
    ),
  },
  'drop-on-sale': {
    label: 'Drop, on sale',
    render: () => (
      <DropView
        drop={{ ...baseDrop, availability: 'on_sale', startsAt: at(-5) }}
        artistAvatar={null}
        viewer={{ ...fan, isMember: false }}
        owned={false}
        tier={tier}
      />
    ),
  },
  'drop-signed-out': {
    label: 'Drop, signed out',
    render: () => (
      <DropView
        drop={{ ...baseDrop, availability: 'on_sale', startsAt: at(-5) }}
        artistAvatar={null}
        viewer={{ signedIn: false, isFan: false, isMember: false }}
        owned={false}
        tier={tier}
      />
    ),
  },
  'drop-video': {
    label: 'Video drop, on sale',
    render: () => (
      <DropView
        drop={videoDrop}
        artistAvatar={null}
        viewer={{ ...fan, isMember: false }}
        owned={false}
        tier={tier}
      />
    ),
  },
  'drop-documentary': {
    label: 'Documentary, before the premiere',
    render: () => (
      <DropView
        drop={documentary}
        artistAvatar={null}
        viewer={{ ...fan, isMember: false }}
        owned={false}
        tier={tier}
      />
    ),
  },
  party: {
    label: 'Listening party, before doors',
    render: () => (
      <PartyView
        party={parties[0]}
        artistAvatar={null}
        viewer={fan}
        hasTicket={false}
        canWatch={false}
      />
    ),
  },
  'party-live': {
    label: 'Listening party, live with ticket',
    render: () => (
      <PartyView
        party={{ ...parties[0], status: 'LIVE' }}
        artistAvatar={null}
        viewer={fan}
        hasTicket
        canWatch
      />
    ),
  },
  membership: {
    label: 'Membership',
    render: () => (
      <MembershipView
        artist={nahvee}
        tier={tier}
        viewer={{ ...fan, isMember: false }}
        drops={drops.filter(d => d.artistId === nahvee.id)}
        parties={parties.filter(p => p.artist.id === nahvee.id)}
      />
    ),
  },
};

export default async function DesignPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === 'production' && process.env.DESIGN_PREVIEW !== 'on') notFound();
  const { view } = await searchParams;
  const current = view && VIEWS[view] ? view : null;

  if (!current) {
    return (
      <div className='stage min-h-screen px-6 py-16'>
        <h1 className='stage-display text-5xl'>Design preview</h1>
        <p className='mt-3 text-stage-muted'>
          Sample data only. Nothing here reaches the database or Stripe.
        </p>
        <ul className='mt-8 space-y-2'>
          {Object.entries(VIEWS).map(([key, { label }]) => (
            <li key={key}>
              <Link
                href={`/design-preview?view=${key}`}
                className='text-stage-pulse underline-offset-4 hover:underline'
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return VIEWS[current].render();
}
