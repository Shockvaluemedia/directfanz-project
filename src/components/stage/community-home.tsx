import { getCommunityHome } from '@/lib/community';
import { CommunityView } from './community-view';
import { getActiveTier, getDropMedia, toStageDrop } from './server';

/**
 * Loads the community and renders its home. Returns null when no community
 * is set up, so each route decides what to show instead.
 */
export async function CommunityHome() {
  const home = await getCommunityHome();
  if (!home) return null;

  const { community, headliner, artists, drops, parties } = home;
  const byId = new Map(artists.map(artist => [artist.id, artist]));
  const [headlinerTier, media] = await Promise.all([
    headliner ? getActiveTier(headliner.id) : Promise.resolve(null),
    getDropMedia(drops.map(drop => drop.id)),
  ]);

  return (
    <CommunityView
      community={community}
      headliner={headliner}
      artists={artists}
      drops={drops.map(drop => {
        const artist = byId.get(drop.artistId);
        return toStageDrop(
          drop,
          artist?.displayName ?? '',
          artist?.avatar ?? null,
          null,
          media.get(drop.id)
        );
      })}
      parties={parties}
      headlinerTier={headlinerTier}
    />
  );
}
