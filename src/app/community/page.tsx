import { notFound } from 'next/navigation';
import { getCommunityHome } from '@/lib/community';
import { CommunityView } from '@/components/stage/community-view';
import { getActiveTier, toStageDrop } from '@/components/stage/server';

export const dynamic = 'force-dynamic';

// The community home: the headliner first, then drops, listening parties and
// the rest of the roster. Data comes from getCommunityHome; the page only
// shapes it for the stage components.
export default async function CommunityPage() {
  const home = await getCommunityHome();
  if (!home) notFound();

  const { community, headliner, artists, drops, parties } = home;
  const byId = new Map(artists.map(artist => [artist.id, artist]));
  const headlinerTier = headliner ? await getActiveTier(headliner.id) : null;

  return (
    <CommunityView
      community={community}
      headliner={headliner}
      artists={artists}
      drops={drops.map(drop => {
        const artist = byId.get(drop.artistId);
        return toStageDrop(drop, artist?.displayName ?? '', artist?.avatar ?? null);
      })}
      parties={parties}
      headlinerTier={headlinerTier}
    />
  );
}
