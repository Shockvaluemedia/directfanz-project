import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCommunityHome } from '@/lib/community';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

const AVAILABILITY_LABELS: Record<string, string> = {
  on_sale: 'On sale',
  presale: 'Members presale',
  not_started: 'Coming soon',
  sold_out: 'Sold out',
};

// The community home: the headliner first, then the rest of the artists,
// their drops and their listening parties.
export default async function CommunityPage() {
  const home = await getCommunityHome();
  if (!home) notFound();

  const { community, headliner, artists, drops, parties } = home;
  const names = new Map(artists.map(artist => [artist.id, artist.displayName]));
  const others = artists.slice(1);

  return (
    <div className='min-h-screen bg-gray-950 text-white'>
      <section className='max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8'>
        <p className='text-sm uppercase tracking-widest text-indigo-300'>{community.name}</p>
        {community.description && (
          <p className='mt-2 max-w-2xl text-gray-300'>{community.description}</p>
        )}
      </section>

      {headliner && (
        <section className='max-w-6xl mx-auto px-4 sm:px-6 pb-12'>
          <Link
            href={`/artist/${headliner.id}`}
            className='flex flex-col sm:flex-row items-start sm:items-center gap-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-purple-900 p-6 sm:p-10 hover:opacity-95'
          >
            {headliner.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headliner.avatar}
                alt=''
                className='h-28 w-28 sm:h-36 sm:w-36 rounded-full object-cover'
              />
            )}
            <div>
              <p className='text-xs uppercase tracking-widest text-indigo-200'>Headlining</p>
              <h1 className='mt-1 text-4xl sm:text-6xl font-extrabold'>{headliner.displayName}</h1>
              {headliner.bio && <p className='mt-3 max-w-xl text-indigo-100'>{headliner.bio}</p>}
            </div>
          </Link>
        </section>
      )}

      {drops.length > 0 && (
        <section className='max-w-6xl mx-auto px-4 sm:px-6 pb-12'>
          <h2 className='text-2xl font-bold mb-4'>Drops</h2>
          <ul className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {drops.map(drop => (
              <li key={drop.id} className='rounded-xl bg-gray-900 p-5'>
                <p className='text-sm text-gray-400'>{names.get(drop.artistId)}</p>
                <h3 className='mt-1 text-lg font-semibold'>{drop.title}</h3>
                <p className='mt-2 text-sm text-gray-300'>
                  {drop.priceType === 'PAY_WHAT_YOU_WANT' ? 'From ' : ''}${drop.price.toFixed(2)}
                  {drop.memberPrice !== null && ` · members $${drop.memberPrice.toFixed(2)}`}
                </p>
                <p className='mt-1 text-xs text-indigo-300'>
                  {AVAILABILITY_LABELS[drop.availability] ?? ''}
                  {drop.availability === 'not_started' && ` · ${formatDate(drop.startsAt)}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parties.length > 0 && (
        <section className='max-w-6xl mx-auto px-4 sm:px-6 pb-12'>
          <h2 className='text-2xl font-bold mb-4'>Listening parties</h2>
          <ul className='grid gap-4 sm:grid-cols-2'>
            {parties.map(party => (
              <li key={party.id} className='rounded-xl bg-gray-900 p-5'>
                <p className='text-sm text-gray-400'>{party.artist.displayName}</p>
                <h3 className='mt-1 text-lg font-semibold'>
                  <Link href={`/stream/${party.id}`} className='hover:underline'>
                    {party.title}
                  </Link>
                </h3>
                <p className='mt-2 text-sm text-gray-300'>
                  {party.status === 'LIVE' ? 'Live now' : formatDate(party.scheduledAt)} · $
                  {party.price}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className='max-w-6xl mx-auto px-4 sm:px-6 pb-16'>
          <h2 className='text-2xl font-bold mb-4'>Artists</h2>
          <ul className='grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'>
            {others.map(artist => (
              <li key={artist.id}>
                <Link
                  href={`/artist/${artist.id}`}
                  className='block rounded-xl bg-gray-900 p-4 hover:bg-gray-800'
                >
                  {artist.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artist.avatar}
                      alt=''
                      className='mb-3 aspect-square w-full rounded-lg object-cover'
                    />
                  )}
                  <p className='font-semibold'>{artist.displayName}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
