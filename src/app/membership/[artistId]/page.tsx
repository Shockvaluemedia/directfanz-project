import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DROP_STATUS, toPublicDrop } from '@/lib/drops';
import { listUpcomingParties } from '@/lib/parties';
import { MembershipView } from '@/components/stage/membership-view';
import {
  getActiveTier,
  getDropMedia,
  getViewer,
  toStageDrop,
  viewerIsMember,
} from '@/components/stage/server';

export const dynamic = 'force-dynamic';

interface MembershipPageProps {
  params: Promise<{ artistId: string }>;
}

async function loadArtist(artistId: string) {
  return prisma.users.findFirst({
    where: { id: artistId, role: 'ARTIST', status: 'ACTIVE' },
    select: { id: true, displayName: true, avatar: true, bio: true },
  });
}

export async function generateMetadata({ params }: MembershipPageProps): Promise<Metadata> {
  const artist = await loadArtist((await params).artistId);
  if (!artist) return { title: 'Artist not found | DirectFanz' };
  return {
    title: `${artist.displayName} membership | DirectFanz`,
    description: `Get in early on ${artist.displayName}'s drops and listening parties.`,
  };
}

// An artist's membership (one monthly tier) with their open drops and parties.
// Joining goes through the existing subscription checkout route.
export default async function MembershipPage({ params }: MembershipPageProps) {
  const artist = await loadArtist((await params).artistId);
  if (!artist) notFound();

  const viewer = await getViewer();
  const now = new Date();
  const [tier, isMember, dropRows, parties] = await Promise.all([
    getActiveTier(artist.id),
    viewerIsMember(viewer.userId, artist.id),
    prisma.drops.findMany({
      where: {
        artistId: artist.id,
        status: DROP_STATUS.PUBLISHED,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: 'asc' },
      take: 6,
      include: { drop_content: { select: { contentId: true } } },
    }),
    listUpcomingParties(artist.id),
  ]);

  const media = await getDropMedia(dropRows.map(drop => drop.id));

  return (
    <MembershipView
      artist={artist}
      tier={tier}
      viewer={{ signedIn: viewer.signedIn, isFan: viewer.isFan, isMember }}
      drops={dropRows.map(drop =>
        toStageDrop(
          toPublicDrop(drop),
          artist.displayName,
          artist.avatar,
          drop.quantityLimit,
          media.get(drop.id)
        )
      )}
      parties={parties}
    />
  );
}
